import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient, fieldKey, listAll, parseApiError } from '../src/api'
import { setUnauthenticatedHandler } from '../src/api/session'

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => setUnauthenticatedHandler(() => {}))

describe('field mapping', () => {
    it('maps a JSON Pointer to a dotted form field key', () => {
        expect(fieldKey('/settings/description')).toBe('settings.description')
        expect(fieldKey('/title')).toBe('title')
        expect(fieldKey('/items/0/label')).toBe('items.0.label')
    })
    it('unescapes ~1 and ~0 in pointer segments', () => {
        expect(fieldKey('/a~1b/c~0d')).toBe('a/b.c~d')
    })
    it('returns a query parameter name as it is', () => {
        expect(fieldKey('limit')).toBe('limit')
        expect(fieldKey('cursor')).toBe('cursor')
    })
    it('returns undefined when no field is given', () => {
        expect(fieldKey(undefined)).toBeUndefined()
        expect(fieldKey(null)).toBeUndefined()
        expect(fieldKey('')).toBeUndefined()
    })
})

describe('error parsing', () => {
    it('reads code, message and field from the error body', () => {
        const error = parseApiError({
            error: { code: 'slug_taken', message: 'Taken.', field: '/slug' },
        })
        expect(error).toBeInstanceOf(ApiError)
        expect(error.code).toBe('slug_taken')
        expect(error.message).toBe('Taken.')
        expect(error.field).toBe('/slug')
    })
    it('leaves field undefined when null or missing', () => {
        expect(
            parseApiError({ error: { code: 'x', message: 'm', field: null } }).field,
        ).toBeUndefined()
        expect(parseApiError({ error: { code: 'x', message: 'm' } }).field).toBeUndefined()
    })
    it('falls back to unknown_error for a body that is not an error', () => {
        expect(parseApiError('<html>').code).toBe('unknown_error')
        expect(parseApiError(undefined).code).toBe('unknown_error')
    })
})

describe('cursor helper', () => {
    it('follows next_cursor until it is null and joins the items', async () => {
        const pages: Record<string, { items: number[]; next_cursor: string | null }> = {
            first: { items: [1, 2], next_cursor: 'a' },
            a: { items: [3], next_cursor: 'b' },
            b: { items: [4], next_cursor: null },
        }
        const fetchPage = vi.fn((cursor: string | undefined) =>
            Promise.resolve(pages[cursor ?? 'first'] ?? { items: [], next_cursor: null }),
        )
        expect(await listAll(fetchPage)).toEqual([1, 2, 3, 4])
        expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([undefined, 'a', 'b'])
    })
    it('stops after one page when next_cursor is null', async () => {
        const fetchPage = vi.fn(() => Promise.resolve({ items: ['x'], next_cursor: null }))
        expect(await listAll(fetchPage)).toEqual(['x'])
        expect(fetchPage).toHaveBeenCalledTimes(1)
    })
    it('throws when the cursor does not advance', async () => {
        const failure = await listAll(() =>
            Promise.resolve({ items: [1], next_cursor: 'same' }),
        ).catch((e: unknown) => e)
        expect(failure).toBeInstanceOf(ApiError)
        expect(failure).toMatchObject({ code: 'unknown_error' })
    })
})

describe('typed client', () => {
    it('sends the request to the base URL and returns typed data', async () => {
        const fetchMock = vi.fn(() => Promise.resolve(json(200, { items: [], next_cursor: null })))
        const api = createApiClient({ baseUrl: 'http://host.test', fetch: fetchMock })
        const { data } = await api.GET('/sites', { params: { query: { limit: 5 } } })
        expect(data?.next_cursor).toBeNull()
        const request = (fetchMock.mock.calls[0] as unknown as [Request])[0]
        expect(request.url).toBe('http://host.test/sites?limit=5')
    })
    it('throws an ApiError carrying code, message and field', async () => {
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () =>
                Promise.resolve(
                    json(400, {
                        error: { code: 'invalid_cursor', message: 'No.', field: 'cursor' },
                    }),
                ),
        })
        const error = await api.GET('/sites').catch((e: unknown) => e)
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).code).toBe('invalid_cursor')
        expect((error as ApiError).field).toBe('cursor')
    })
    it('sends 401 unauthenticated to the one handler and still throws', async () => {
        const handler = vi.fn()
        setUnauthenticatedHandler(handler)
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () =>
                Promise.resolve(
                    json(401, { error: { code: 'unauthenticated', message: 'Sign in.' } }),
                ),
        })
        await expect(api.GET('/sites')).rejects.toMatchObject({ code: 'unauthenticated' })
        expect(handler).toHaveBeenCalledTimes(1)
    })
    it('does not call the handler for other error codes', async () => {
        const handler = vi.fn()
        setUnauthenticatedHandler(handler)
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () =>
                Promise.resolve(json(404, { error: { code: 'site_not_found', message: 'No.' } })),
        })
        await expect(api.GET('/sites')).rejects.toMatchObject({ code: 'site_not_found' })
        expect(handler).not.toHaveBeenCalled()
    })
    it('turns a network failure into an ApiError with code unknown_error', async () => {
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () => Promise.reject(new TypeError('failed')),
        })
        await expect(api.GET('/sites')).rejects.toMatchObject({ code: 'unknown_error' })
    })
    it('passes an aborted request through as an AbortError, not an ApiError', async () => {
        const controller = new AbortController()
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () => Promise.reject(new DOMException('aborted', 'AbortError')),
        })
        controller.abort()
        const error = await api
            .GET('/sites', { signal: controller.signal })
            .catch((e: unknown) => e)
        expect(error).toBeInstanceOf(DOMException)
        expect(error).not.toBeInstanceOf(ApiError)
    })
    it('turns a 2xx with a non-JSON body into an ApiError with code unknown_error', async () => {
        const api = createApiClient({
            baseUrl: 'http://host.test',
            fetch: () => Promise.resolve(new Response('<html>', { status: 200 })),
        })
        const error = await api.GET('/sites').catch((e: unknown) => e)
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).code).toBe('unknown_error')
    })
})

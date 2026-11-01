import createClient, { type Middleware } from 'openapi-fetch'
import { config } from '../config'
import { ApiError, UNKNOWN_ERROR_CODE, parseApiError } from './errors'
import type { paths } from './schema'
import { handleUnauthenticated } from './session'

/**
 * Turns every failed response into an ApiError and sends `unauthenticated`
 * to the one handler. Successful calls return `{ data }` as usual.
 *
 * Every failure is an ApiError, with one exception: when the caller aborts
 * its own `signal` (e.g. on unmount) the AbortError passes through unchanged.
 * A cancel is not a failure, so callers should ignore it, not show it.
 */
export const errorMiddleware: Middleware = {
    async onResponse({ response }) {
        if (response.ok) {
            // A 2xx that is not JSON (proxy or SPA fallback page) must not leak a SyntaxError.
            if (response.status === 204 || response.status === 205 || response.body === null) {
                return undefined
            }
            const text = await response.clone().text()
            if (text === '') return undefined
            try {
                JSON.parse(text)
            } catch {
                throw new ApiError(UNKNOWN_ERROR_CODE, 'Something went wrong. Try again.')
            }
            return undefined
        }
        const body: unknown = await response
            .clone()
            .json()
            .catch(() => undefined)
        const error = parseApiError(body)
        if (error.code === 'unauthenticated') handleUnauthenticated()
        throw error
    },
    onError({ error }) {
        if (error instanceof ApiError) return error
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        return new ApiError(UNKNOWN_ERROR_CODE, 'Could not reach Hivesite. Check your connection.')
    },
}

export function createApiClient(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
    const client = createClient<paths>({
        baseUrl: options.baseUrl ?? config.apiBaseUrl,
        ...(options.fetch ? { fetch: options.fetch } : {}),
    })
    client.use(errorMiddleware)
    return client
}

/**
 * The studio's typed client. Failed calls throw ApiError, so they never
 * resolve with `error`. The types still mark `data` as possibly `undefined`
 * (openapi-fetch's union), but after an awaited call it is set unless the
 * operation returns no body (204).
 */
export const api = createApiClient()

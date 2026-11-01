import createClient, { type Middleware } from 'openapi-fetch'
import { config } from '../config'
import { ApiError, UNKNOWN_ERROR_CODE, parseApiError } from './errors'
import type { paths } from './schema'
import { handleUnauthenticated } from './session'

/**
 * Turns every failed response into an ApiError and sends `unauthenticated`
 * to the one handler. Successful calls return `{ data }` as usual.
 */
export const errorMiddleware: Middleware = {
    async onResponse({ response }) {
        if (response.ok) return undefined
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

/** The studio's typed client. Calls throw ApiError; they never resolve with `error`. */
export const api = createApiClient()

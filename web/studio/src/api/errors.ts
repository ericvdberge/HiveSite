import type { components } from './schema'

type ErrorBody = components['schemas']['Error']

/** Used when the Host sent no usable error body (network failure, proxy page, …). */
export const UNKNOWN_ERROR_CODE = 'unknown_error'

/** The one error the client throws. Branch on `code` only, never on status or `message`. */
export class ApiError extends Error {
    readonly code: string
    readonly field: string | undefined

    constructor(code: string, message: string, field?: string) {
        super(message)
        this.name = 'ApiError'
        this.code = code
        this.field = field
    }
}

export function isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError
}

/** Reads `{ "error": { code, message, field? } }` (specs/STYLE.md). Never throws. */
export function parseApiError(body: unknown): ApiError {
    const error = (body as { error?: Partial<ErrorBody> } | null | undefined)?.error
    if (error && typeof error.code === 'string' && typeof error.message === 'string') {
        return new ApiError(
            error.code,
            error.message,
            typeof error.field === 'string' ? error.field : undefined,
        )
    }
    return new ApiError(UNKNOWN_ERROR_CODE, 'Something went wrong. Try again.')
}

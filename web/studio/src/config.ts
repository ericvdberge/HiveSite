const DEFAULT_API_BASE_URL = 'http://localhost:5000'

/**
 * The one place the studio reads its configuration.
 * `VITE_API_BASE_URL` is the base URL of the Hivesite Host.
 */
export const config = {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
} as const

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('config', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.resetModules()
    })

    it('reads the Host base URL from VITE_API_BASE_URL', async () => {
        vi.stubEnv('VITE_API_BASE_URL', 'http://example.test:8080/')
        const { config } = await import('../src/config')
        expect(config.apiBaseUrl).toBe('http://example.test:8080')
    })

    it('falls back to the local Host when VITE_API_BASE_URL is empty', async () => {
        vi.stubEnv('VITE_API_BASE_URL', '')
        const { config } = await import('../src/config')
        expect(config.apiBaseUrl).toBe('http://localhost:5000')
    })
})

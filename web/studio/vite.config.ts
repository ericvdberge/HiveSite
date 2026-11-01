import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    server: {
        // The Host allows this origin for CORS (#49). Keep it fixed.
        port: 5173,
        strictPort: true,
    },
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
    },
})

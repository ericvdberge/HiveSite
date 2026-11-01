import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { breakpointPlugin } from './scripts/tokens.mjs'

export default defineConfig({
    plugins: [vue()],
    // Media queries cannot read custom properties, so `breakpoint(md)` is replaced at build time.
    css: { postcss: { plugins: [breakpointPlugin()] } },
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

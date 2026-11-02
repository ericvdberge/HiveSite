import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type UserConfig } from 'vite'

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

/** The SSR bundle: render.mjs with Vue and every dependency inside. `themesJson` is read at build time and inlined. */
export function renderBundle(outDir: string, themesJson: string): UserConfig {
    return {
        root: here('.'),
        logLevel: 'warn',
        plugins: [vue()],
        resolve: {
            // The runtime build: templates are compiled at build time, so the compiler stays out of the bundle.
            alias: [
                { find: 'hivesite-themes', replacement: themesJson },
                { find: /^vue$/, replacement: here('node_modules/vue/dist/vue.runtime.esm-bundler.js') },
            ],
            dedupe: ['vue'],
        },
        define: {
            'process.env.NODE_ENV': '"production"',
            __VUE_OPTIONS_API__: 'false',
            __VUE_PROD_DEVTOOLS__: 'false',
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        },
        ssr: { noExternal: true, target: 'node' },
        build: {
            ssr: here('src/render.ts'),
            outDir,
            emptyOutDir: false,
            target: 'node24',
            minify: false,
            rollupOptions: { output: { format: 'es', entryFileNames: 'render.mjs', codeSplitting: false } },
        },
    }
}

export default defineConfig(renderBundle(here('dist'), here('dist/themes.json')))

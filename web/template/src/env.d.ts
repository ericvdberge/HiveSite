declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<object, object, unknown>
    export default component
}

/** The registry `npm run build` writes to dist/themes.json, inlined into render.mjs (see vite.config.ts). */
declare module 'hivesite-themes' {
    import type { ThemeRegistry } from './build.ts'
    const registry: ThemeRegistry
    export default registry
}

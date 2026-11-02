import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import Document from './components/Document.vue'
import { createShell, type ThemeEntry } from './context.ts'
import { homeOf } from './links.ts'
import type { RenderedFile, RenderRequest, SnapshotPage } from './request.ts'

export interface ThemeRegistry {
    themes: ThemeEntry[]
}

async function renderDocument(request: RenderRequest, theme: ThemeEntry, current: SnapshotPage | null): Promise<string> {
    const shell = createShell({
        mode: request.mode,
        previewTheme: request.preview_theme,
        snapshot: request.snapshot,
        theme,
        current,
        notFound: current === null,
    })
    // Vue logs a component error and carries on; a build must fail instead.
    const app = createSSRApp(Document, { shell })
    const errors: unknown[] = []
    app.config.errorHandler = (error) => void errors.push(error)
    const html = await renderToString(app)
    if (errors.length > 0) throw errors[0]
    return '<!doctype html>' + html
}

/** A snapshot in, files out. Pure: the same request gives the same bytes. */
export async function buildFiles(request: RenderRequest, registry: ThemeRegistry): Promise<RenderedFile[]> {
    const { pages, site } = request.snapshot
    const theme = registry.themes.find((t) => t.key === site.settings.theme)
    if (!theme) throw new Error(`Unknown theme "${site.settings.theme}"`)

    if (request.mode === 'preview') {
        const page = pages.find((p) => p.id === request.page_id)
        if (!page) throw new Error('page_id is not in the snapshot')
        const path = page === homeOf(pages) ? '/' : `/${page.slug}`
        return [{ path, html: await renderDocument(request, theme, page) }]
    }

    const files: RenderedFile[] = []
    const home = homeOf(pages)
    for (const page of [...pages].sort((a, b) => a.menu_order - b.menu_order)) {
        files.push({ path: page === home ? '/' : `/${page.slug}`, html: await renderDocument(request, theme, page) })
    }
    files.push({ path: '/404.html', html: await renderDocument(request, theme, null) })
    return files
}

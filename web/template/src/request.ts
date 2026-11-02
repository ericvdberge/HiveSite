export interface SnapshotPage {
    id: string
    title: string
    slug: string
    menu_order: number
    created_at: string
    blocks: { type: 'doc'; content?: { type: string; attrs?: Record<string, unknown> }[] }
}
export interface Snapshot {
    snapshot_format: 1
    site: {
        id: string
        name: string
        slug: string
        settings: { language: string; description: string; theme: string }
    }
    pages: SnapshotPage[]
}
export interface RenderRequest {
    mode: 'preview' | 'release'
    page_id: string | null
    preview_theme: string | null
    snapshot: Snapshot
}
export interface RenderedFile {
    path: string
    html: string
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Parses the request. Content validated the blocks already, so only the envelope is checked here. */
export function parseRequest(text: string): RenderRequest {
    let value: unknown
    try {
        value = JSON.parse(text)
    } catch {
        throw new Error('The request is not JSON')
    }
    if (!isObject(value)) throw new Error('The request must be a JSON object')
    const { mode, page_id: pageId, preview_theme: previewTheme, snapshot } = value
    if (mode !== 'preview' && mode !== 'release') throw new Error(`Unknown mode: ${JSON.stringify(mode)}`)
    if (!isObject(snapshot)) throw new Error('The request has no snapshot')
    if (snapshot['snapshot_format'] !== 1) throw new Error(`Unsupported snapshot_format: ${JSON.stringify(snapshot['snapshot_format'])}`)
    const site = snapshot['site']
    if (!isObject(site) || !isObject(site['settings'])) throw new Error('The snapshot has no site')
    const pages = snapshot['pages']
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('The snapshot has no pages')
    if (!pages.every((p) => isObject(p) && typeof p['id'] === 'string')) throw new Error('The snapshot has a page without an id')
    if (mode === 'preview' && !pages.some((p) => (p as SnapshotPage).id === pageId)) throw new Error('page_id is not in the snapshot')
    if (previewTheme !== null && previewTheme !== undefined && typeof previewTheme !== 'string') throw new Error('preview_theme must be a string or null')
    return {
        mode,
        page_id: mode === 'preview' ? (pageId as string) : null,
        preview_theme: mode === 'preview' ? ((previewTheme as string | null | undefined) ?? null) : null,
        snapshot: snapshot as unknown as Snapshot,
    }
}

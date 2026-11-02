import type { RenderRequest, Snapshot, SnapshotPage } from '../../src/request.ts'

export const HOME_ID = '01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0'
export const ABOUT_ID = '01a181d4-5e8b-75fc-bd2f-613219bf3f79'
export const WORK_ID = '01a181d8-810e-7cfa-b14e-65065bb59fa1'

export type Block = { type: string; attrs?: Record<string, unknown> }
export type HeroAttrs = { title: string; subtitle?: string; image?: { url: string; alt: string } | null; cta?: { label: string; href: string } | null }

export const hero = (attrs: HeroAttrs): Block => ({
    type: 'hero',
    attrs: { subtitle: '', image: null, cta: null, ...attrs },
})

const page = (id: string, title: string, slug: string, menu_order: number, content: Block[]): SnapshotPage => ({
    id,
    title,
    slug,
    menu_order,
    created_at: '2026-10-28T09:20:00Z',
    blocks: { type: 'doc', content },
})

/** Atelier Noor of API-011: three pages, `nl`; "Our work" holds the given blocks. */
export function atelierNoor(work: Block[], settings: Partial<Snapshot['site']['settings']> = {}, slug = 'atelier-noor'): Snapshot {
    return {
        snapshot_format: 1,
        site: {
            id: '01a181c9-b7ca-70bc-abf5-a9e81e300af7',
            name: 'Atelier Noor',
            slug,
            settings: { language: 'nl', description: 'Handmade ceramics from Utrecht.', theme: 'atelier', ...settings },
        },
        pages: [page(HOME_ID, 'Home', 'home', 0, []), page(ABOUT_ID, 'About', 'about', 1, []), page(WORK_ID, 'Our work', 'our-work', 2, work)],
    }
}

export const preview = (snapshot: Snapshot, pageId: string = WORK_ID, previewTheme: string | null = null): RenderRequest => ({
    mode: 'preview',
    page_id: pageId,
    preview_theme: previewTheme,
    snapshot,
})
export const release = (snapshot: Snapshot): RenderRequest => ({ mode: 'release', page_id: null, preview_theme: null, snapshot })

export const withTheme = (snapshot: Snapshot, theme: string): Snapshot => ({
    ...snapshot,
    site: { ...snapshot.site, settings: { ...snapshot.site.settings, theme } },
})

export const image = { url: 'https://images.example.com/noor/vases.jpg', alt: 'Three celadon vases on linen' }

/** The hero fixtures of AC17. */
export const heroFixtures: Record<string, Block[]> = {
    'text-only': [hero({ title: 'Selected work', subtitle: 'Bowls, vases and tableware.', cta: { label: 'Meet the maker', href: '/about' } })],
    image: [hero({ title: 'Selected work', subtitle: 'Bowls, vases and tableware.', image, cta: { label: 'Meet the maker', href: '/about' } })],
    'image-empty-alt': [hero({ title: 'Selected work', image: { url: image.url, alt: '' } })],
    'title-only': [hero({ title: 'Selected work' })],
    'second-block': [hero({ title: 'First' }), hero({ title: 'Selected work', subtitle: 'Bowls, vases and tableware.' })],
}

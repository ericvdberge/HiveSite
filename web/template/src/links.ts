import type { ResolvedLink } from '@hivesite/blocks'
import type { SnapshotPage } from './request.ts'

export interface LinkOptions {
    mode: 'preview' | 'release'
    previewTheme: string | null
    pages: SnapshotPage[]
}

/** The page a link or file belongs to is the home page when it has the lowest `menu_order`. */
export const homeOf = (pages: SnapshotPage[]): SnapshotPage => {
    const home = [...pages].sort((a, b) => a.menu_order - b.menu_order)[0]
    if (!home) throw new Error('The snapshot has no pages')
    return home
}

export function pageHref(page: SnapshotPage, options: LinkOptions): string {
    if (options.mode === 'preview') {
        const query = options.previewTheme === null ? '' : `?theme=${encodeURIComponent(options.previewTheme)}`
        return `/pages/${page.id}/preview${query}`
    }
    return page === homeOf(options.pages) ? './' : page.slug
}

/** Content hrefs: `https://` and `mailto:` as stored, site paths matched against the pages. */
export function resolveLink(href: string, options: LinkOptions): ResolvedLink {
    if (href.startsWith('https://') || href.startsWith('mailto:')) return { missing: false, href }
    if (href.startsWith('/')) {
        const home = homeOf(options.pages)
        const slug = href.slice(1)
        const page = slug === '' ? home : options.pages.find((p) => p.slug === slug)
        if (page) return { missing: false, href: pageHref(page, options) }
    }
    return { missing: true }
}

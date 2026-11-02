import type { InjectionKey } from 'vue'
import type { BlockContext } from '@hivesite/blocks'
import { homeOf, pageHref, resolveLink, type LinkOptions } from './links.ts'
import type { Snapshot, SnapshotPage } from './request.ts'
import { stringsFor } from './strings.ts'

export interface ThemeEntry {
    key: string
    color_scheme: string
    assets: { stylesheet: string }
}

/** What the page shell needs on top of what blocks get. */
export interface ShellContext extends BlockContext {
    site: Snapshot['site']
    /** Pages in `menu_order`. */
    pages: SnapshotPage[]
    current: SnapshotPage | null
    notFound: boolean
    stylesheet: string
    colorScheme: string
    homeHref: string
    pageHref(page: SnapshotPage): string
}

export const shellKey: InjectionKey<ShellContext> = Symbol('hivesite-shell')

export interface ShellInput {
    mode: 'preview' | 'release'
    previewTheme: string | null
    snapshot: Snapshot
    theme: ThemeEntry
    current: SnapshotPage | null
    notFound: boolean
}

export function createShell({ mode, previewTheme, snapshot, theme, current, notFound }: ShellInput): ShellContext {
    const pages = [...snapshot.pages].sort((a, b) => a.menu_order - b.menu_order)
    const options: LinkOptions = { mode, previewTheme, pages }
    const file = theme.assets.stylesheet
    return {
        mode,
        site: snapshot.site,
        pages,
        current,
        notFound,
        strings: stringsFor(snapshot.site.settings.language),
        stylesheet: mode === 'preview' ? `/themes/${theme.key}/assets/${file}` : `assets/${file}`,
        colorScheme: theme.color_scheme,
        homeHref: pageHref(homeOf(pages), options),
        pageHref: (page) => pageHref(page, options),
        resolveLink: (href) => resolveLink(href, options),
    }
}

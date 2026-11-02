import { inject, type InjectionKey } from 'vue'

export interface Strings {
    skipLink: string
    mainMenu: string
    required: string
    previewLabel: string
    notFoundTitle: string
    notFoundText: string
    backHome: string
    gallery: string
    cardList: string
    contactForm: string
}

/** A content href after Links: written as stored, or a site path that matches no page. */
export type ResolvedLink = { missing: false; href: string } | { missing: true }

export interface BlockContext {
    mode: 'preview' | 'release'
    strings: Strings
    resolveLink(href: string): ResolvedLink
}

export const blockContextKey: InjectionKey<BlockContext> = Symbol('hivesite-block-context')

export function useBlockContext(): BlockContext {
    const context = inject(blockContextKey)
    if (!context) throw new Error('Block rendered without a block context')
    return context
}

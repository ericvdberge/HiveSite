// Which block types have a form, and what each one needs: its form, its client checks and its
// defaults for a new block. A type without an entry stays "unsupported" (shown as a Note).

import type { Component } from 'vue'
import { checkLink, checkMax, checkText, checkUrl } from './checks'
import HeroForm from './forms/HeroForm.vue'
import { HERO_LIMITS, URL_MAX } from './limits'
import type { BlockNode, Json } from './model'

/** Copy of the broken rules by path inside `attrs`, in field order. Empty when the block is fine. */
export type FieldErrors = Record<string, string>

export interface BlockEntry {
    form: Component
    /** Checks a block as it will be sent (strings already trimmed). */
    check(node: BlockNode): FieldErrors
    /** A new block with the schema defaults; required fields start empty (Field controls). */
    newBlock(): BlockNode
}

function obj(value: Json | undefined): Record<string, Json> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

const str = (value: Json | undefined) => (typeof value === 'string' ? value : '')

function checkHero(node: BlockNode): FieldErrors {
    const errors: FieldErrors = {}
    const attrs = node.attrs ?? {}
    const add = (path: string, error: string) => {
        if (error) errors[path] = error
    }
    add('title', checkText('Title', str(attrs.title), HERO_LIMITS.title))
    add('subtitle', checkMax(str(attrs.subtitle), HERO_LIMITS.subtitle))
    const image = obj(attrs.image)
    if (image) {
        add('image.url', checkUrl(str(image.url), URL_MAX))
        add('image.alt', checkMax(str(image.alt), HERO_LIMITS.imageAlt))
    }
    const cta = obj(attrs.cta)
    if (cta) {
        add('cta.label', checkText('Button label', str(cta.label), HERO_LIMITS.ctaLabel))
        add('cta.href', checkLink(str(cta.href), URL_MAX))
    }
    return errors
}

export const registry: Readonly<Record<string, BlockEntry>> = {
    hero: {
        form: HeroForm,
        check: checkHero,
        newBlock: () => ({
            type: 'hero',
            attrs: { title: '', subtitle: '', image: null, cta: null },
        }),
    },
}

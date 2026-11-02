// The one-line summary of a block's head (block-editor.md, Layout, Summary).
import type { BlockNode, Json } from './model'

export const EMPTY_SUMMARY = 'Not filled in yet'

const PROVIDERS: Record<string, string> = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    google_maps: 'Google Maps',
}

const SORTS: Record<string, string> = {
    newest: 'Pages of this site, newest first',
    title: 'Pages of this site, A to Z',
    natural: 'Pages of this site, in menu order',
}

type Obj = Record<string, Json>

function obj(value: unknown): Obj {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Obj)
        : {}
}

function str(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function plural(n: number, one: string, many: string): string {
    return n === 0 ? '' : `${n} ${n === 1 ? one : many}`
}

function size(value: unknown): number {
    return Array.isArray(value) ? value.length : 0
}

function nodeText(node: unknown): string {
    const n = obj(node)
    if (typeof n.text === 'string') return n.text
    return Array.isArray(n.content) ? n.content.map(nodeText).join('') : ''
}

function richTextSummary(node: BlockNode): string {
    for (const child of node.content ?? []) {
        const c = obj(child)
        if (c.type !== 'heading' && c.type !== 'paragraph') continue
        const text = nodeText(c).trim()
        if (text) return text
    }
    return ''
}

/** Parts joined with " · "; empty parts are left out. */
function join(...parts: string[]): string {
    return parts.filter(Boolean).join(' · ')
}

/** What the block holds, in one line. Never throws on an unexpected shape. */
export function blockSummary(node: BlockNode): string {
    const a = obj(node.attrs)
    let text = ''
    switch (node.type) {
        case 'hero':
            text = str(a.title)
            break
        case 'rich_text':
            text = richTextSummary(node)
            break
        case 'image': {
            const image = obj(a.image)
            if (!str(image.url) && !str(image.alt) && !str(a.caption)) return EMPTY_SUMMARY
            return str(image.alt) || str(a.caption) || 'No alt text'
        }
        case 'gallery':
            text = join(str(a.heading), plural(size(a.images), 'image', 'images'))
            break
        case 'card_list': {
            const source = obj(a.source)
            const what =
                source.kind === 'collection'
                    ? (SORTS[str(source.sort)] ?? SORTS.natural ?? '')
                    : plural(size(source.cards), 'card', 'cards')
            text = join(str(a.heading), what)
            break
        }
        case 'contact_form':
            text = join(str(a.heading), plural(size(a.fields), 'field', 'fields'))
            break
        case 'embed':
            text = join(str(a.title), PROVIDERS[str(a.provider)] ?? '')
            break
    }
    return text || EMPTY_SUMMARY
}

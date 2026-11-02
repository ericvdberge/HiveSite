// The working copy of a page's blocks and the one rule that turns it into the document to send
// (block-editor.md, Data). Plain TypeScript with no Vue, so it is unit tested.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export interface BlockNode {
    type: string
    attrs?: Record<string, Json>
    content?: Json[]
}

export interface BlocksDocument {
    type: 'doc'
    content: BlockNode[]
}

/** The seven block types this studio has forms for (API-003), all at version 1. */
export const SUPPORTED_TYPES = [
    'hero',
    'rich_text',
    'image',
    'gallery',
    'card_list',
    'contact_form',
    'embed',
] as const

export const SUPPORTED_VERSION = 1

export interface WorkingBlock {
    /** Stable for the life of the screen; not sent. */
    key: string
    node: BlockNode
    /** Unknown type, or a version other than 1: shown read-only and sent as loaded. */
    readOnly: boolean
}

export interface WorkingCopy {
    blocks: WorkingBlock[]
}

export type TypeVersions = ReadonlyMap<string, number>

export function isSupported(type: string, versions: TypeVersions): boolean {
    return (
        (SUPPORTED_TYPES as readonly string[]).includes(type) &&
        Number(versions.get(type)) === SUPPORTED_VERSION
    )
}

type Obj = Record<string, Json>

function isObj(value: unknown): value is Obj {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

/** The working copy of a loaded document: a deep copy, so editing never touches the saved one. */
export function toWorkingCopy(doc: BlocksDocument, versions: TypeVersions): WorkingCopy {
    return {
        blocks: doc.content.map((node, i) => ({
            key: `b${i + 1}`,
            node: clone(node),
            readOnly: !isSupported(node.type, versions),
        })),
    }
}

/** Plain strings trimmed, everywhere below `value`. */
function trimmed(value: Json): Json {
    if (typeof value === 'string') return value.trim()
    if (Array.isArray(value)) return value.map(trimmed)
    if (isObj(value)) {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trimmed(v)]))
    }
    return value
}

/** An unchecked optional object stays `null`; a present image always sends `alt`. */
function withAlt(value: Json | undefined): Json | undefined {
    if (!isObj(value)) return value
    return { ...value, alt: typeof value.alt === 'string' ? value.alt : '' }
}

function setIfPresent(target: Obj, key: string, fn: (v: Json | undefined) => Json | undefined) {
    if (key in target) target[key] = fn(target[key]) as Json
}

function cardListSource(source: Json | undefined): Json | undefined {
    if (!isObj(source)) return source
    if (source.kind === 'collection') {
        const kept: Obj = { kind: 'collection' }
        for (const key of ['entity_type', 'sort', 'page_size']) {
            if (key in source) kept[key] = source[key] as Json
        }
        return kept
    }
    const cards = Array.isArray(source.cards) ? source.cards : []
    return {
        kind: 'manual',
        cards: cards.map((card) => {
            if (!isObj(card)) return card
            const out: Obj = { ...card }
            setIfPresent(out, 'image', withAlt)
            return out
        }),
    }
}

function blockToSend(block: WorkingBlock): BlockNode {
    const node = block.node
    // An unsupported block goes back exactly as it was loaded; rich text is sent as Tiptap emits it.
    if (block.readOnly || node.type === 'rich_text' || !node.attrs) return clone(node)
    const attrs = trimmed(node.attrs) as Obj
    switch (node.type) {
        case 'hero':
        case 'image':
            setIfPresent(attrs, 'image', withAlt)
            break
        case 'gallery':
            setIfPresent(attrs, 'images', (images) =>
                Array.isArray(images) ? images.map((i) => withAlt(i) as Json) : images,
            )
            break
        case 'card_list':
            setIfPresent(attrs, 'source', cardListSource)
            break
    }
    return { ...node, attrs }
}

/** The document to send: the only thing the studio sends, measures or compares. */
export function documentToSend(copy: WorkingCopy): BlocksDocument {
    return { type: 'doc', content: copy.blocks.map(blockToSend) }
}

/** Equal when they hold the same keys and values, whatever the key order. Arrays keep their order. */
export function sameDocument(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (Array.isArray(a) || Array.isArray(b)) {
        return (
            Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((item, i) => sameDocument(item, b[i]))
        )
    }
    if (isObj(a) && isObj(b)) {
        const keys = Object.keys(a)
        return (
            keys.length === Object.keys(b).length &&
            keys.every((k) => k in b && sameDocument(a[k], b[k]))
        )
    }
    return false
}

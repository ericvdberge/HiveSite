import { describe, expect, it } from 'vitest'
import {
    documentToSend,
    sameDocument,
    toWorkingCopy,
    type BlocksDocument,
    type TypeVersions,
} from '../src/blocks/model'

const versions: TypeVersions = new Map([
    ['hero', 1],
    ['rich_text', 1],
    ['image', 1],
    ['gallery', 1],
    ['card_list', 1],
    ['contact_form', 1],
    ['embed', 1],
])

/** A document as the server returns it: defaults filled, every alt present, nulls explicit. */
const served: BlocksDocument = {
    type: 'doc',
    content: [
        {
            type: 'hero',
            attrs: {
                title: 'Made slowly',
                subtitle: '',
                image: { url: 'https://example.com/a.jpg', alt: '' },
                cta: null,
            },
        },
        {
            type: 'rich_text',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: ' kept as is ' }] }],
        },
        {
            type: 'gallery',
            attrs: {
                heading: '',
                columns: 3,
                images: [{ url: 'https://example.com/b.jpg', alt: 'B', caption: '' }],
            },
        },
        {
            type: 'card_list',
            attrs: {
                heading: 'Work',
                layout: 'grid',
                source: {
                    kind: 'manual',
                    cards: [{ title: 'One', body: '', image: null, action: null }],
                },
            },
        },
        {
            type: 'card_list',
            attrs: {
                heading: '',
                layout: 'list',
                source: { kind: 'collection', entity_type: 'page', sort: 'newest', page_size: 12 },
            },
        },
        { type: 'future_block', attrs: { title: '  untouched  ', extra: [1, 2] } },
    ],
}

describe('the document to send', () => {
    it('(AC8) returns a document equal to the loaded one for a document the server returned', () => {
        const copy = toWorkingCopy(served, versions)
        expect(sameDocument(documentToSend(copy), served)).toBe(true)
    })

    it('(AC8) the working copy is a deep copy of the loaded document', () => {
        const copy = toWorkingCopy(served, versions)
        const hero = copy.blocks[0]?.node.attrs
        if (hero) hero.title = 'Changed'
        expect(served.content[0]?.attrs?.title).toBe('Made slowly')
    })

    it('(AC8) trims plain strings in supported blocks', () => {
        const copy = toWorkingCopy(served, versions)
        const hero = copy.blocks[0]?.node.attrs
        if (hero) hero.title = '  Hello  '
        expect(documentToSend(copy).content[0]?.attrs?.title).toBe('Hello')
    })

    it('(AC8) sends every alt, as an empty string when it is missing', () => {
        const doc: BlocksDocument = {
            type: 'doc',
            content: [
                {
                    type: 'image',
                    attrs: { image: { url: 'https://example.com/a.jpg' }, caption: '' },
                },
                { type: 'gallery', attrs: { images: [{ url: 'https://example.com/a.jpg' }] } },
            ],
        }
        const sent = documentToSend(toWorkingCopy(doc, versions))
        expect(sent.content[0]?.attrs?.image).toEqual({ url: 'https://example.com/a.jpg', alt: '' })
        expect(sent.content[1]?.attrs?.images).toEqual([
            { url: 'https://example.com/a.jpg', alt: '' },
        ])
    })

    it('(AC8) keeps an unchecked optional object as null', () => {
        const sent = documentToSend(toWorkingCopy(served, versions))
        expect(sent.content[0]?.attrs?.cta).toBeNull()
    })

    it('(AC8) sends only the chosen card_list source', () => {
        const doc: BlocksDocument = {
            type: 'doc',
            content: [
                {
                    type: 'card_list',
                    attrs: {
                        source: {
                            kind: 'collection',
                            entity_type: 'page',
                            sort: 'title',
                            page_size: 5,
                            cards: [{ title: 'kept in the copy only' }],
                        },
                    },
                },
                {
                    type: 'card_list',
                    attrs: { source: { kind: 'manual', cards: [], sort: 'title', page_size: 5 } },
                },
            ],
        }
        const sent = documentToSend(toWorkingCopy(doc, versions))
        expect(sent.content[0]?.attrs?.source).toEqual({
            kind: 'collection',
            entity_type: 'page',
            sort: 'title',
            page_size: 5,
        })
        expect(sent.content[1]?.attrs?.source).toEqual({ kind: 'manual', cards: [] })
    })

    it('(AC8) sends an unsupported block exactly as it was loaded', () => {
        const sent = documentToSend(toWorkingCopy(served, versions))
        expect(sent.content[5]).toEqual(served.content[5])
        const newer = new Map(versions).set('hero', 2)
        const copy = toWorkingCopy(
            { type: 'doc', content: [{ type: 'hero', attrs: { title: '  spaced  ' } }] },
            newer,
        )
        expect(copy.blocks[0]?.readOnly).toBe(true)
        expect(documentToSend(copy).content[0]?.attrs?.title).toBe('  spaced  ')
    })
})

describe('same document', () => {
    it('(AC8) equal documents are the same', () => {
        expect(sameDocument(served, structuredClone(served))).toBe(true)
    })

    it('(AC8) a different value, key or order of blocks is not the same', () => {
        const changed = structuredClone(served)
        const hero = changed.content[0]?.attrs
        if (hero) hero.title = 'Other'
        expect(sameDocument(served, changed)).toBe(false)

        const extra = structuredClone(served)
        const first = extra.content[0]?.attrs
        if (first) first.extra = true
        expect(sameDocument(served, extra)).toBe(false)

        const moved = structuredClone(served)
        moved.content.reverse()
        expect(sameDocument(served, moved)).toBe(false)
    })

    it('(AC8) key order does not count', () => {
        const a = { type: 'doc', content: [{ type: 'hero', attrs: { title: 'A', subtitle: '' } }] }
        const b = { content: [{ attrs: { subtitle: '', title: 'A' }, type: 'hero' }], type: 'doc' }
        expect(sameDocument(a, b)).toBe(true)
    })
})

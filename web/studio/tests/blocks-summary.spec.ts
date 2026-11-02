import { describe, expect, it } from 'vitest'
import type { BlockNode } from '../src/blocks/model'
import { blockSummary } from '../src/blocks/summary'

const s = (type: string, attrs?: BlockNode['attrs'], content?: BlockNode['content']) =>
    blockSummary({ type, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) })

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

describe('block summary', () => {
    it('(AC4) hero: the title', () => {
        expect(s('hero', { title: 'Made slowly' })).toBe('Made slowly')
    })

    it('(AC4) rich text: the first heading or paragraph with text', () => {
        expect(
            s('rich_text', undefined, [
                { type: 'paragraph' },
                {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'The studio' }],
                },
                para('Later'),
            ]),
        ).toBe('The studio')
        expect(s('rich_text', undefined, [para('Only text')])).toBe('Only text')
    })

    it('(AC4) image: the alt text, else the caption, else "No alt text"', () => {
        const url = 'https://example.com/a.jpg'
        expect(s('image', { image: { url, alt: 'A bowl' }, caption: 'Cap' })).toBe('A bowl')
        expect(s('image', { image: { url, alt: '' }, caption: 'Cap' })).toBe('Cap')
        expect(s('image', { image: { url, alt: '' }, caption: '' })).toBe('No alt text')
    })

    it('(AC4) gallery: the heading, then the number of images', () => {
        const images = Array.from({ length: 6 }, () => ({
            url: 'https://example.com/a.jpg',
            alt: '',
        }))
        expect(s('gallery', { heading: 'Work', images })).toBe('Work · 6 images')
        expect(s('gallery', { heading: '', images })).toBe('6 images')
        expect(s('gallery', { heading: '', images: images.slice(0, 1) })).toBe('1 image')
    })

    it('(AC4) card list: the heading, then the cards or the pages of the site', () => {
        const cards = [{ title: 'a' }, { title: 'b' }, { title: 'c' }]
        expect(s('card_list', { heading: 'Pieces', source: { kind: 'manual', cards } })).toBe(
            'Pieces · 3 cards',
        )
        expect(
            s('card_list', { heading: '', source: { kind: 'collection', sort: 'newest' } }),
        ).toBe('Pages of this site, newest first')
    })

    it('(AC4) contact form: the heading, then the number of fields', () => {
        const fields = [1, 2, 3, 4].map((n) => ({ label: `L${n}`, name: `n${n}` }))
        expect(s('contact_form', { heading: 'Write to us', fields })).toBe('Write to us · 4 fields')
    })

    it('(AC4) embed: the title, then the provider name', () => {
        expect(s('embed', { title: 'Our studio', provider: 'google_maps' })).toBe(
            'Our studio · Google Maps',
        )
        expect(s('embed', { title: 'Film', provider: 'youtube' })).toBe('Film · YouTube')
    })

    it('(AC4) an empty block reads "Not filled in yet"', () => {
        expect(s('hero', { title: '' })).toBe('Not filled in yet')
        expect(s('rich_text', undefined, [{ type: 'paragraph' }])).toBe('Not filled in yet')
        expect(s('gallery', { heading: '', images: [] })).toBe('Not filled in yet')
        expect(s('embed', { title: '', provider: '' })).toBe('Not filled in yet')
        expect(s('contact_form')).toBe('Not filled in yet')
    })
})

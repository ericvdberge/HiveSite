import { describe, expect, it } from 'vitest'
import {
    LINK_COPY,
    URL_COPY,
    checkLink,
    checkMax,
    checkRequired,
    checkText,
    checkUrl,
} from '../src/blocks/checks'
import { registry } from '../src/blocks/registry'

describe('client checks', () => {
    it('(AC4) an empty required string says "Enter a title."', () => {
        expect(checkRequired('Title', '   ')).toBe('Enter a title.')
        expect(checkText('Button label', '', 30)).toBe('Enter a button label.')
        expect(checkText('Title', 'Made slowly', 80)).toBe('')
    })

    it('(AC4) a string over the limit says "Use {max} characters or fewer."', () => {
        expect(checkMax('x'.repeat(81), 80)).toBe('Use 80 characters or fewer.')
        expect(checkText('Title', 'x'.repeat(81), 80)).toBe('Use 80 characters or fewer.')
    })

    it('(AC3) lengths count code points after trimming: 80 emoji pass, 81 fail', () => {
        expect(checkText('Title', `  ${'😀'.repeat(80)}  `, 80)).toBe('')
        expect(checkText('Title', '😀'.repeat(81), 80)).not.toBe('')
    })

    it('(AC4) the image address needs https:// and a host, with the https:// copy', () => {
        expect(checkUrl('https://example.com/a.jpg', 2048)).toBe('')
        for (const bad of ['', 'http://example.com', 'https://', 'https:// x', 'example.com']) {
            expect(checkUrl(bad, 2048)).toBe(URL_COPY)
        }
        expect(URL_COPY).toBe('Use an address that starts with https://, with no spaces.')
        expect(checkUrl(`https://a.test/${'x'.repeat(2048)}`, 2048)).toBe(
            'Use 2048 characters or fewer.',
        )
    })

    it('(AC4) mailto:, / and /about pass as a link; https:// with no host fails', () => {
        for (const ok of [
            'mailto:hi@example.com',
            '/',
            '/about',
            '/about/team',
            'https://a.test',
        ]) {
            expect(checkLink(ok, 2048)).toBe('')
        }
        for (const bad of ['', 'https://', 'about', '/About', 'mailto:', '/a b']) {
            expect(checkLink(bad, 2048)).toBe(LINK_COPY)
        }
        expect(LINK_COPY).toBe(
            'Use a page path such as /about, an address that starts with https://, or a mailto: address.',
        )
    })

    it('(AC4) the hero check reports fields in form order and skips unchecked objects', () => {
        const hero = registry['hero']
        const ok = { type: 'hero', attrs: { title: 'A', subtitle: '', image: null, cta: null } }
        expect(hero?.check(ok)).toEqual({})
        const bad = {
            type: 'hero',
            attrs: {
                title: '',
                subtitle: 'x'.repeat(161),
                image: { url: 'nope', alt: '' },
                cta: { label: '', href: 'nope' },
            },
        }
        expect(Object.keys(hero?.check(bad) ?? {})).toEqual([
            'title',
            'subtitle',
            'image.url',
            'cta.label',
            'cta.href',
        ])
    })
})

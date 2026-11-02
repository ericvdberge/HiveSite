import { describe, expect, it } from 'vitest'
import { atelierNoor, heroFixtures, hero, image, preview, release, withTheme } from './fixtures/snapshots.ts'
import { render, renderOne, THEMES } from './helpers.ts'

describe('hero block', () => {
    it('renders the markup of the design note_AC16', async () => {
        const html = await renderOne(preview(atelierNoor(heroFixtures['image']!)))
        expect(html).toContain(
            '<section class="hs-hero" id="hs-b0" data-variant="image">' +
                `<img class="hs-hero__image" src="${image.url}" alt="${image.alt}" loading="eager" decoding="async">` +
                '<div class="hs-hero__body"><h1 class="hs-hero__title">Selected work</h1>' +
                '<p class="hs-hero__subtitle">Bowls, vases and tableware.</p>' +
                '<a class="hs-button" href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">Meet the maker</a></div></section>',
        )
    })

    it('leaves out the image, subtitle and button when absent_AC16', async () => {
        const html = await renderOne(preview(atelierNoor(heroFixtures['title-only']!)))
        expect(html).toContain('data-variant="text"')
        expect(html).not.toMatch(/hs-hero__image|hs-hero__subtitle|hs-button/)
    })

    it('keeps an empty alt_AC16', async () => {
        const html = await renderOne(preview(atelierNoor(heroFixtures['image-empty-alt']!)))
        expect(html).toContain('alt="" loading="eager"')
    })

    it('shows a cta to a missing page as text_AC16', async () => {
        const html = await renderOne(preview(atelierNoor([hero({ title: 'T', cta: { label: 'Gone', href: '/gone' } })])))
        expect(html).toContain('<span class="hs-link-missing">Gone</span>')
        expect(html).not.toContain('hs-button')
    })

    it('escapes every owner value in text and attributes_AC14', async () => {
        const evil = `<script>alert("x")</script> ' & "`
        const snapshot = atelierNoor(
            [hero({ title: evil, subtitle: evil, image: { url: `https://x.test/a.jpg?a=1&b="${evil}`, alt: evil }, cta: { label: evil, href: `https://x.test/?q="${evil}` } })],
            { description: evil },
        )
        snapshot.site.name = evil
        for (const page of snapshot.pages) page.title = evil
        for (const mode of [preview(snapshot), release(snapshot)]) {
            for (const html of Object.values(await render(mode))) {
                expect(html).not.toContain('<script')
                expect(html).not.toContain('alert("x")')
                expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
                expect(html).toContain('&#39;')
            }
        }
    })

    for (const theme of THEMES) {
        for (const [name, blocks] of Object.entries(heroFixtures)) {
            for (const make of [preview, release]) {
                const mode = make === preview ? 'preview' : 'release'
                it(`matches the snapshot of ${name}, ${theme}, ${mode}_AC17`, async () => {
                    const request = make(withTheme(atelierNoor(blocks), theme))
                    const html = Object.values(await render(request))[0]!
                    await expect(html).toMatchFileSnapshot(`__snapshots__/hero/${theme}-${mode}-${name}.html`)
                })
            }
        }
    }

    it('keeps one h1 and uses h2 for a hero at index 1_AC9', async () => {
        const html = await renderOne(preview(atelierNoor(heroFixtures['second-block']!)))
        expect(html.match(/<h1/g)).toHaveLength(1)
        expect(html).toContain('<h2 class="hs-hero__title">Selected work</h2>')
    })
})

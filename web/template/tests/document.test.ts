import { describe, expect, it } from 'vitest'
import { ABOUT_ID, atelierNoor, HOME_ID, heroFixtures, preview, release, WORK_ID } from './fixtures/snapshots.ts'
import { plain, render, renderOne, stylesheetOf } from './helpers.ts'

const work = heroFixtures['image']!

describe('document', () => {
    it('has the structure of the Our work example_AC5', async () => {
        const html = await renderOne(preview(atelierNoor(work)))
        const css = stylesheetOf('atelier')
        const order = [
            '<!doctype html><html lang="nl" data-theme="atelier"><head>',
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="robots" content="noindex">',
            '<meta name="generator" content="Hivesite">',
            '<meta name="color-scheme" content="dark">',
            '<title>Our work · Atelier Noor</title>',
            '<meta name="description" content="Handmade ceramics from Utrecht.">',
            `<link rel="stylesheet" href="/themes/atelier/assets/${css}">`,
            '</head><body>',
            '<a class="hs-skip" href="#hs-main">Naar de inhoud</a>',
            '<p class="hs-preview-label">Voorbeeld · niet gepubliceerd</p>',
            '<header class="hs-header"><a class="hs-header__name" href="/pages/' + HOME_ID + '/preview">Atelier Noor</a>',
            '<nav class="hs-menu" aria-label="Hoofdmenu">',
            '<main class="hs-main" id="hs-main">',
            '<footer class="hs-footer"><p class="hs-footer__name">Atelier Noor</p></footer>',
        ]
        let at = -1
        for (const part of order) {
            const next = html.indexOf(part, at + 1)
            expect(next, part).toBeGreaterThan(at)
            at = next
        }
    })

    it('leaves out the description when empty and follows the color scheme_AC6', async () => {
        const noDescription = await renderOne(preview(atelierNoor(work, { description: '' })))
        expect(noDescription).not.toContain('name="description"')
        const light = await renderOne(preview(atelierNoor(work, { theme: 'ivory' })))
        expect(light).toContain('<meta name="color-scheme" content="light">')
    })

    it('has no robots meta, preview label and absolute stylesheet in release_AC6', async () => {
        const files = await render(release(atelierNoor(work)))
        const html = files['/our-work']!
        expect(html).not.toContain('robots')
        expect(html).not.toContain('hs-preview-label')
        expect(html).toContain(`<link rel="stylesheet" href="assets/${stylesheetOf('atelier')}">`)
    })

    it('titles the home page with the site name only_AC7', async () => {
        const home = await renderOne(preview(atelierNoor(work), HOME_ID))
        expect(home).toContain('<title>Atelier Noor</title>')
        const other = await renderOne(preview(atelierNoor(work), ABOUT_ID))
        expect(other).toContain('<title>About · Atelier Noor</title>')
    })

    it('lists every page in menu order with aria-current on the current page only_AC8', async () => {
        const snapshot = atelierNoor(work)
        snapshot.pages.reverse()
        const html = await renderOne(preview(snapshot, ABOUT_ID))
        const items = [...html.matchAll(/<li><a href="[^"]*"( aria-current="page")?>([^<]*)<\/a><\/li>/g)]
        expect(items.map((m) => m[2])).toEqual(['Home', 'About', 'Our work'])
        expect(items.map((m) => m[1] !== undefined)).toEqual([false, true, false])
        expect(html.match(/aria-current/g)).toHaveLength(1)
    })

    it('starts main with the headings rule_AC9', async () => {
        const first = await renderOne(preview(atelierNoor(work)))
        expect(first.match(/<h1/g)).toHaveLength(1)
        expect(first).toContain('<h1 class="hs-hero__title">')
        // Hero is the only block type so far; a page without blocks has no hero at 0 either.
        const html = await renderOne(preview(atelierNoor([])))
        expect(html).toContain('<main class="hs-main" id="hs-main"><h1 class="hs-page-title">Our work</h1>')
        expect(html.match(/<h1/g)).toHaveLength(1)
    })

    it('translates the built-in text by the primary language subtag_AC10', async () => {
        const dutch = ['Naar de inhoud', 'Hoofdmenu', 'Voorbeeld · niet gepubliceerd']
        const english = ['Skip to content', 'Main menu', 'Preview · not published']
        for (const [language, expected] of [['nl', dutch], ['nl-BE', dutch], ['en', english], ['de', english]] as const) {
            const html = await renderOne(preview(atelierNoor(work, { language })))
            for (const text of expected) expect(html, language).toContain(text)
        }
    })

    it('builds the not-found page_AC13', async () => {
        for (const [language, title, text, back] of [
            ['nl', 'Pagina niet gevonden', 'Deze pagina bestaat niet (meer).', 'Terug naar de startpagina'],
            ['en', 'Page not found', 'This page does not exist (any more).', 'Back to the home page'],
        ] as const) {
            const html = plain((await render(release(atelierNoor(work, { language }))))['/404.html']!)
            expect(html).toContain('<meta charset="utf-8"><base href="/s/atelier-noor/">')
            expect(html).toContain(`<title>${title} · Atelier Noor</title>`)
            expect(html).not.toContain('aria-current')
            expect(html).toContain(
                `<main class="hs-main" id="hs-main"><h1 class="hs-page-title">${title}</h1><p>${text}</p><a class="hs-back" href="./">${back}</a></main>`,
            )
        }
    })

    it('fails on an unknown block type_AC3', async () => {
        const snapshot = atelierNoor([{ type: 'marquee', attrs: {} }])
        await expect(render(preview(snapshot, WORK_ID))).rejects.toThrow('Unknown block type "marquee"')
    })
})

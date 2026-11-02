import { describe, expect, it } from 'vitest'
import { ABOUT_ID, atelierNoor, hero, HOME_ID, preview, release, WORK_ID, type Block } from './fixtures/snapshots.ts'
import { render, renderOne } from './helpers.ts'

const linked = (...hrefs: string[]): Block[] => hrefs.map((href) => hero({ title: 'T', cta: { label: `to ${href}`, href } }))
const hrefs = [...['https://x.test', 'mailto:a@b.test', '/', '/about', '/home', '/gone']]

const ctas = (html: string): string[] =>
    [...html.matchAll(/<a class="hs-button" href="([^"]*)">|<span class="hs-link-missing">([^<]*)<\/span>/g)].map((m) => m[1] ?? `missing:${m[2]}`)

describe('links', () => {
    it('resolves hrefs in preview mode_AC11', async () => {
        const html = await renderOne(preview(atelierNoor(linked(...hrefs))))
        expect(ctas(html)).toEqual([
            'https://x.test',
            'mailto:a@b.test',
            `/pages/${HOME_ID}/preview`,
            `/pages/${ABOUT_ID}/preview`,
            `/pages/${HOME_ID}/preview`,
            'missing:to /gone',
        ])
        expect(html).not.toMatch(/<a [^>]*(target|rel)=/)
    })

    it('adds the preview theme to page links only_AC11', async () => {
        const html = await renderOne(preview(atelierNoor(linked('https://x.test', '/about')), WORK_ID, 'ivory'))
        expect(ctas(html)).toEqual(['https://x.test', `/pages/${ABOUT_ID}/preview?theme=ivory`])
        expect(html).toContain(`<a href="/pages/${WORK_ID}/preview?theme=ivory" aria-current="page">`)
    })

    it('uses relative links in release mode and never the site slug_AC12', async () => {
        const slug = 'zq-unique-slug'
        const files = await render(release(atelierNoor(linked(...hrefs), {}, slug)))
        expect(Object.keys(files)).toEqual(['/', '/about', '/our-work', '/404.html'])
        const html = files['/our-work']!
        expect(ctas(html)).toEqual(['https://x.test', 'mailto:a@b.test', './', 'about', './', 'missing:to /gone'])
        expect(html).toContain('<a class="hs-header__name" href="./">')
        expect(html).toContain('<li><a href="about">About</a></li>')
        for (const [path, content] of Object.entries(files)) {
            if (path === '/404.html') expect(content).toContain(slug)
            else expect(content).not.toContain(slug)
        }
    })
})

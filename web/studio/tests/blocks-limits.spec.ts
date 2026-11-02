import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkLink, checkUrl } from '../src/blocks/checks'
import { HERO_LIMITS, URL_MAX } from '../src/blocks/limits'

// Tests run from web/studio; the schemas live in the Content module at the repo root.
const dir = resolve(process.cwd(), '../../src/Modules/Content/Hivesite.Content/BlockTypes')
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'))
const hero = read('hero.json')
const defs = read('defs.json')

describe('hero limits', () => {
    it("(AC10) the studio's hero limits equal maxLength in Content's hero.json and defs.json", () => {
        const attrs = hero.properties.attrs.properties
        expect(HERO_LIMITS.title).toBe(attrs.title.maxLength)
        expect(HERO_LIMITS.subtitle).toBe(attrs.subtitle.maxLength)
        expect(HERO_LIMITS.imageAlt).toBe(defs.image.properties.alt.maxLength)
        expect(HERO_LIMITS.ctaLabel).toBe(defs.action.properties.label.maxLength)
        expect(URL_MAX).toBe(defs.url.maxLength)
        expect(URL_MAX).toBe(defs.link.maxLength)
    })

    it('(AC10) whatever the schema patterns refuse, the checks refuse too', () => {
        const urlRe = new RegExp(defs.url.pattern)
        const linkRe = new RegExp(defs.link.pattern)
        // The client also needs a host, so it may refuse more than the schema, never less.
        for (const v of ['https://a.test', 'http://a.test', 'https://', 'a b', '/about']) {
            if (!urlRe.test(v)) expect(checkUrl(v, URL_MAX)).not.toBe('')
        }
        for (const v of ['/', '/about', '/a/b', '/About', 'mailto:a@b.c', 'https://a.test', 'x']) {
            if (!linkRe.test(v)) expect(checkLink(v, URL_MAX)).not.toBe('')
        }
    })
})

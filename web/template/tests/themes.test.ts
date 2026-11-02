import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildThemes } from '../src/theme/build.ts'
import { atLeast } from '../src/theme/media.ts'
import { cssName, customProperties, flatten, loadTokens, type Tokens } from '../src/theme/tokens.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const tokens = loadTokens()
const keys = Object.keys(tokens.themes)

interface Entry {
    key: string
    name: string
    description: string
    color_scheme: string
    version: number
    sample: Record<string, string>
    assets: { stylesheet: string; fonts: string[] }
}
interface Manifest {
    version: number
    default_theme: string
    themes: Entry[]
}

const build = (t: Tokens = tokens): string => {
    const out = mkdtempSync(join(tmpdir(), 'hs-themes-'))
    buildThemes(t, out)
    return out
}
const read = (out: string, key: string, file: string): string => readFileSync(join(out, 'themes', key, file), 'utf8')
const sha8 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex').slice(0, 8)
const snapshotDir = (dir: string): Record<string, string> => {
    const result: Record<string, string> = {}
    const walk = (d: string): void => {
        for (const name of readdirSync(d)) {
            const p = join(d, name)
            if (statSync(p).isDirectory()) walk(p)
            else result[p.slice(dir.length)] = createHash('sha256').update(readFileSync(p)).digest('hex')
        }
    }
    walk(dir)
    return result
}

let out: string
let manifest: Manifest
beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'hs-cli-'))
    execFileSync('node', ['scripts/build-themes.mjs', out], { cwd: fileURLToPath(new URL('..', import.meta.url)) })
    manifest = JSON.parse(readFileSync(join(out, 'themes.json'), 'utf8')) as Manifest
})

describe('themes', () => {
    it('lists the three themes with their token values_AC1', () => {
        expect(manifest.themes.map((t) => t.key)).toEqual(['atelier', 'ivory', 'studio'])
        for (const entry of manifest.themes) {
            const theme = tokens.themes[entry.key]!
            const value = (p: string): string => flatten(theme).find(([n]) => n === p)![1]
            expect(entry.name).toBe(theme.name)
            expect(entry.description).toBe(theme.description)
            expect(entry.color_scheme).toBe(theme.color_scheme)
            expect(entry.version).toBe(1)
            expect(entry.sample).toEqual({
                background: value('color.background'),
                surface: value('color.surface'),
                text: value('color.text'),
                accent: value('color.accent'),
                display_font: value('font.display'),
            })
            expect(entry.assets.stylesheet).toMatch(/\.css$/)
            expect(entry.assets.fonts.length).toBeGreaterThan(0)
        }
    })

    it('uses valid keys equal to the token keys and atelier as default_theme_AC2', () => {
        const listed = manifest.themes.map((t) => t.key)
        for (const key of listed) expect(key).toMatch(/^[a-z][a-z0-9_]{1,29}$/)
        expect([...listed].sort()).toEqual([...keys].sort())
        expect(manifest.default_theme).toBe('atelier')
    })

    it('writes every token as a custom property on :root first_AC3', () => {
        for (const key of keys) {
            const css = read(out, key, manifest.themes.find((t) => t.key === key)!.assets.stylesheet)
            expect(css.startsWith(':root{')).toBe(true)
            const rule = css.slice(0, css.indexOf('}') + 1)
            for (const [path, value] of flatten(tokens.themes[key]!)) expect(rule).toContain(`${cssName(path)}:${value}`)
            expect(cssName('color.text_muted')).toBe('--hs-color-text-muted')
            expect(cssName('space.5')).toBe('--hs-space-5')
            expect(rule).toBe(`:root{${customProperties(tokens.themes[key]!)}}`)
        }
    })

    it('writes media widths from breakpoint tokens only_AC4', () => {
        expect(atLeast('md', tokens.themes['atelier']!)).toBe('(min-width:60rem)')
        for (const key of keys) {
            const theme = tokens.themes[key]!
            const css = read(out, key, manifest.themes.find((t) => t.key === key)!.assets.stylesheet)
            const widths = new Set(Object.values(theme['breakpoint'] as Record<string, string>))
            const queries = [...css.matchAll(/@media([^{]*)\{/g)].map((m) => m[1]!)
            expect(queries.length).toBeGreaterThan(0)
            for (const q of queries) {
                expect(q).not.toContain('var(')
                for (const m of q.matchAll(/width\s*:\s*([^)\s]+)/g)) expect(widths.has(m[1]!)).toBe(true)
            }
        }
    })

    it('orders tokens, font faces, block styles and stays under 128 KB_AC5', () => {
        for (const entry of manifest.themes) {
            const css = read(out, entry.key, entry.assets.stylesheet)
            const root = css.indexOf(':root{')
            const face = css.indexOf('@font-face')
            const base = css.indexOf('body{')
            expect(root).toBe(0)
            expect(face).toBeGreaterThan(root)
            expect(base).toBeGreaterThan(css.lastIndexOf('@font-face'))
            expect(Buffer.byteLength(css)).toBeLessThanOrEqual(131_072)
        }
    })

    it('references local woff2 files by bare name and covers the font tokens_AC6', () => {
        for (const entry of manifest.themes) {
            const theme = tokens.themes[entry.key]!
            const css = read(out, entry.key, entry.assets.stylesheet)
            expect(entry.assets.fonts.length).toBeLessThanOrEqual(6)
            const urls = [...css.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1]!)
            expect(urls.length).toBe(entry.assets.fonts.length)
            for (const url of urls) {
                expect(url).toMatch(/^[a-z0-9.-]+\.woff2$/)
                expect(url).not.toMatch(/\/|\.\.|:/)
                expect(entry.assets.fonts).toContain(url)
                expect(statSync(join(out, 'themes', entry.key, url)).isFile()).toBe(true)
            }
            const fonts = theme['font'] as Record<string, string>
            const weights = theme['font_weight'] as Record<string, string>
            for (const [role, stack] of Object.entries(fonts)) {
                const family = /^"([^"]+)"/.exec(stack)![1]!
                for (const w of [weights[role], weights[`${role}_strong`]]) {
                    if (w === undefined) continue
                    expect(css).toMatch(new RegExp(`@font-face\\{font-family:"${family}";[^}]*font-weight:${w};`))
                }
            }
        }
    })

    it('names assets by content hash and builds deterministically_AC7', () => {
        for (const entry of manifest.themes) {
            for (const name of [entry.assets.stylesheet, ...entry.assets.fonts]) {
                expect(name).toMatch(/^[a-z0-9-]+\.[0-9a-f]{8}\.(css|woff2)$/)
                const bytes = readFileSync(join(out, 'themes', entry.key, name))
                expect(name.split('.')[1]).toBe(sha8(bytes))
            }
        }
        expect(snapshotDir(build())).toEqual(snapshotDir(build()))

        const changed = structuredClone(tokens)
        ;(changed.themes['atelier']!['color'] as Record<string, string>)['accent'] = '#CDAE75'
        const before = manifest.themes[0]!.assets.stylesheet
        const after = (JSON.parse(readFileSync(join(build(changed), 'themes.json'), 'utf8')) as Manifest).themes[0]!.assets.stylesheet
        expect(after).not.toBe(before)
    })

    it('keeps durations at 300 ms or more and applies reduced motion_AC8', () => {
        for (const entry of manifest.themes) {
            const motion = tokens.themes[entry.key]!['motion'] as Record<string, string>
            for (const [name, value] of Object.entries(motion)) {
                if (!name.startsWith('duration_')) continue
                expect(value).toMatch(/^\d+ms$/)
                expect(parseInt(value, 10)).toBeGreaterThanOrEqual(300)
            }
            const css = read(out, entry.key, entry.assets.stylesheet)
            const block = /@media \(prefers-reduced-motion:reduce\)\{:root\{([^}]*)\}/.exec(css)
            expect(block).not.toBeNull()
            expect(block![1]).toContain('var(--hs-motion-reduced-duration)')
            expect(block![1]).toContain('var(--hs-motion-reduced-rise-distance)')
        }
    })

    it('passes the contrast check_AC9', () => {
        const run = spawnSync('node', ['design/check-contrast.mjs', 'design/tokens.json'], { cwd: root, encoding: 'utf8' })
        expect(run.stdout + run.stderr).toBeDefined()
        expect(run.status).toBe(0)
    })

    it('fails naming the theme and token when a token is in one theme only_AC10', () => {
        const extra = structuredClone(tokens)
        ;(extra.themes['ivory']!['color'] as Record<string, string>)['brand'] = '#000000'
        expect(() => build(extra)).toThrow(/ivory.*color\.brand/)

        const missing = structuredClone(tokens)
        delete (missing.themes['studio']!['space'] as Record<string, string>)['5']
        expect(() => build(missing)).toThrow(/studio.*space\.5/)
    })
})

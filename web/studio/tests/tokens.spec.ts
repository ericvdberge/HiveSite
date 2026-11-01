import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    breakpointPlugin,
    breakpoints,
    buildTokensCss,
    replaceBreakpoints,
    tokensCssPath,
    tokensJsonPath,
} from '../scripts/tokens.mjs'

const tokens = JSON.parse(readFileSync(tokensJsonPath, 'utf8'))

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) sourceFiles(path, out)
        else if (/\.(vue|css)$/.test(name)) out.push(path)
    }
    return out
}

describe('design tokens', () => {
    it('CSS custom properties: tokens.css matches tokens.json (no drift)', () => {
        const committed = readFileSync(tokensCssPath, 'utf8')
        expect(committed).toBe(buildTokensCss(tokens))
    })

    it('CSS custom properties: brand colors and the three typefaces are defined from the atelier theme', () => {
        const css = readFileSync(tokensCssPath, 'utf8')
        expect(css).toContain('--hs-color-background: #100E0B;')
        expect(css).toContain('--hs-color-accent: #CDAE74;')
        expect(css).toContain('--hs-font-display: "Cormorant Garamond"')
        expect(css).toContain('--hs-font-text: "Hanken Grotesk"')
        expect(css).toContain('--hs-font-label: "IBM Plex Mono"')
    })

    it('every var(--hs-*) used in the source is defined in tokens.css', () => {
        const defined = new Set(
            [...readFileSync(tokensCssPath, 'utf8').matchAll(/(--hs-[a-z0-9-]+):/g)].map(
                (m) => m[1],
            ),
        )
        const used = new Set<string>()
        for (const file of sourceFiles('src')) {
            for (const m of readFileSync(file, 'utf8').matchAll(
                /var\(\s*(--hs-[a-z0-9-]+)\s*[,)]/g,
            )) {
                used.add(m[1] as string)
            }
        }
        expect(used.size).toBeGreaterThan(0)
        expect([...used].filter((name) => !defined.has(name))).toEqual([])
    })

    it('breakpoints: breakpoint(name) in a media query becomes the token value', () => {
        const bps = breakpoints(tokens)
        expect(replaceBreakpoints('(width >= breakpoint(md))', bps)).toBe(`(width >= ${bps.md})`)
        expect(() => replaceBreakpoints('breakpoint(xl)', bps)).toThrow()
        const rule = { params: '(width < breakpoint(sm))' }
        breakpointPlugin(bps).AtRule(rule)
        expect(rule.params).toBe(`(width < ${bps.sm})`)
    })

    it('breakpoints: names with digits or capitals and any at-rule are handled or rejected loudly', () => {
        const bps: Record<string, string> = { ...breakpoints(tokens), '2xl': '99rem' }
        expect(replaceBreakpoints('(width >= breakpoint( 2xl ))', bps)).toBe('(width >= 99rem)')
        expect(() => replaceBreakpoints('(width >= breakpoint(MD))', bps)).toThrow(/Unknown/)
        expect(() => replaceBreakpoints('(width >= breakpoint())', bps)).toThrow(/Unknown/)
        expect(() => replaceBreakpoints('breakpoint(md', bps)).toThrow(/Unresolved/)
        const container = { params: 'sidebar (width >= breakpoint(md))' }
        breakpointPlugin(bps).AtRule(container)
        expect(container.params).toBe(`sidebar (width >= ${bps.md})`)
        expect(() =>
            breakpointPlugin(bps).AtRule({ params: '(width >= breakpoint(nope))' }),
        ).toThrow()
    })

    it('token gaps: literals are explicit and a stand-in pointing at a missing token throws', () => {
        const css = buildTokensCss(tokens)
        expect(css).toContain('--hs-layout-nav-width: max-content;')
        expect(css).toMatch(/--hs-color-overlay: var\(--hs-color-image-scrim\);/)
        expect(() =>
            buildTokensCss(tokens, 'atelier', { 'color.zzz_gap': 'color.no_such_token' }),
        ).toThrow(/unknown token/)
        expect(buildTokensCss(tokens, 'atelier', { 'x.gap': { literal: 'auto' } })).toContain(
            '--hs-x-gap: auto;',
        )
    })
})

describe('no hard-coded design values', () => {
    const files = sourceFiles('src').filter((f) => !f.endsWith('tokens.css'))

    function stripComments(text: string) {
        return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')
    }

    it('components and styles contain no hex, px, rem or ms literals', () => {
        expect(files.length).toBeGreaterThan(3)
        const offenders: string[] = []
        for (const file of files) {
            const text = stripComments(readFileSync(file, 'utf8'))
            const found = text.match(
                /#[0-9a-fA-F]{3,8}\b|\b\d*\.?\d+(px|rem|em|vh|vw|ms|s)\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/g,
            )
            if (found) offenders.push(`${file}: ${found.join(', ')}`)
        }
        expect(offenders).toEqual([])
    })
})

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
            for (const m of readFileSync(file, 'utf8').matchAll(/var\((--hs-[a-z0-9-]+)\)/g)) {
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
        breakpointPlugin(bps).AtRule.media(rule)
        expect(rule.params).toBe(`(width < ${bps.sm})`)
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
            const found = text.match(/#[0-9a-fA-F]{3,8}\b|\b\d*\.?\d+(px|rem|ms)\b|rgba?\(/g)
            if (found) offenders.push(`${file}: ${found.join(', ')}`)
        }
        expect(offenders).toEqual([])
    })
})

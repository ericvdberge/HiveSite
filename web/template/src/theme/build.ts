import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { assertSameTokens, cssName, customProperties, flatten, type ThemeTokens, type Tokens } from './tokens.ts'
import { resolveBreakpoints } from './media.ts'

export const MAX_STYLESHEET_BYTES = 131_072
export const MAX_FONTS = 6

/** Block and shell styles are appended here by later stories: (theme) => CSS using var(--hs-…) only. */
export type StyleSource = (theme: ThemeTokens) => string
export const styleSources: StyleSource[] = []

const require = createRequire(import.meta.url)
const baseCss = readFileSync(new URL('../styles/base.css', import.meta.url), 'utf8')

const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex').slice(0, 8)

/** Reduced-motion overrides, one per duration, the stagger and the rise distance, generated from the tokens. */
export function reducedMotion(theme: ThemeTokens): string {
    const motion = theme['motion'] as Record<string, string>
    const names = Object.keys(motion).filter((n) => n.startsWith('duration_') || n === 'stagger')
    const rules = names.map((n) => `${cssName('motion.' + n)}:var(--hs-motion-reduced-duration)`)
    rules.push(`${cssName('motion.rise_distance')}:var(--hs-motion-reduced-rise-distance)`)
    return `@media (prefers-reduced-motion:reduce){:root{${rules.join(';')}}}`
}

/** Every var(--hs-…) a style uses must be a token of the theme. */
function assertReferences(key: string, theme: ThemeTokens, css: string): void {
    const known = new Set(flatten(theme).map(([p]) => cssName(p)))
    for (const m of css.matchAll(/var\((--hs-[a-z0-9-]+)/g)) {
        const name = m[1] ?? ''
        if (!known.has(name)) throw new Error(`Theme "${key}" is missing the token behind ${name}`)
    }
}

function minify(css: string): string {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/ ?([{};,]) ?/g, '$1')
        .trim()
}

export interface FontFace {
    family: string
    weight: string
    slug: string
}

/** The families and weights a theme uses: `font.X` pairs with `font_weight.X` and `font_weight.X_strong`. */
export function fontsOf(theme: ThemeTokens): FontFace[] {
    const fonts = theme['font'] as Record<string, string>
    const weights = theme['font_weight'] as Record<string, string>
    const seen = new Map<string, FontFace>()
    for (const [role, stack] of Object.entries(fonts)) {
        const family = /^"([^"]+)"/.exec(stack)?.[1]
        if (!family) throw new Error(`font.${role} does not start with a quoted family`)
        const base = weights[role]
        if (base === undefined) throw new Error(`Theme is missing token "font_weight.${role}"`)
        for (const w of [base, weights[`${role}_strong`]]) {
            if (w === undefined) continue
            const slug = family.toLowerCase().replaceAll(' ', '-')
            seen.set(`${slug}-${w}`, { family, weight: w, slug })
        }
    }
    return [...seen.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0) || Number(a.weight) - Number(b.weight))
}

export interface ThemeAssets {
    stylesheet: string
    fonts: string[]
}

export function buildTheme(key: string, theme: ThemeTokens, outDir: string): ThemeAssets {
    const dir = join(outDir, 'themes', key)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })

    const faces = fontsOf(theme)
    if (faces.length > MAX_FONTS) throw new Error(`Theme "${key}" needs ${faces.length} font files, the limit is ${MAX_FONTS}`)
    const fontNames: string[] = []
    const fontRules: string[] = []
    for (const face of faces) {
        const pkg = dirname(require.resolve(`@fontsource/${face.slug}/package.json`))
        const source = join(pkg, 'files', `${face.slug}-latin-${face.weight}-normal.woff2`)
        const name = `${face.slug}-${face.weight}.${hash(readFileSync(source))}.woff2`
        copyFileSync(source, join(dir, name))
        fontNames.push(name)
        fontRules.push(
            `@font-face{font-family:"${face.family}";font-style:normal;font-weight:${face.weight};font-display:swap;src:url(${name}) format("woff2")}`,
        )
    }

    const blockStyles = styleSources.map((s) => minify(resolveBreakpoints(s(theme), theme)))
    const css =
        [`:root{${customProperties(theme)}}`, ...fontRules, minify(resolveBreakpoints(baseCss, theme)), ...blockStyles, reducedMotion(theme)].join('\n') +
        '\n'
    assertReferences(key, theme, css)
    const bytes = Buffer.from(css, 'utf8')
    if (bytes.length > MAX_STYLESHEET_BYTES) {
        throw new Error(`Theme "${key}" stylesheet is ${bytes.length} bytes, the limit is ${MAX_STYLESHEET_BYTES}`)
    }
    const stylesheet = `theme.${hash(bytes)}.css`
    writeFileSync(join(dir, stylesheet), bytes)
    return { stylesheet, fonts: fontNames }
}

export function buildThemes(tokens: Tokens, outDir: string): void {
    assertSameTokens(tokens)
    rmSync(join(outDir, 'themes'), { recursive: true, force: true })
    rmSync(join(outDir, 'themes.json'), { force: true })
    const themes = Object.entries(tokens.themes).map(([key, theme]) => {
        const value = (path: string): string => {
            const found = flatten(theme).find(([p]) => p === path)
            if (!found) throw new Error(`Theme "${key}" is missing token "${path}"`)
            return found[1]
        }
        return {
            key,
            name: theme.name,
            description: theme.description,
            color_scheme: theme.color_scheme,
            version: tokens.version,
            sample: {
                background: value('color.background'),
                surface: value('color.surface'),
                text: value('color.text'),
                accent: value('color.accent'),
                display_font: value('font.display'),
            },
            assets: buildTheme(key, theme, outDir),
        }
    })
    mkdirSync(outDir, { recursive: true })
    const manifest = { version: tokens.version, default_theme: tokens.default_theme, themes }
    writeFileSync(join(outDir, 'themes.json'), JSON.stringify(manifest, null, 2) + '\n')
}

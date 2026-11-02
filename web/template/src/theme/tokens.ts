import { readFileSync } from 'node:fs'

export interface ThemeTokens {
    name: string
    description: string
    color_scheme: string
    [group: string]: string | Record<string, string>
}
export interface Tokens {
    version: number
    default_theme: string
    themes: Record<string, ThemeTokens>
}

const tokensUrl = new URL('../../../../design/tokens.json', import.meta.url)

export function loadTokens(): Tokens {
    return JSON.parse(readFileSync(tokensUrl, 'utf8')) as Tokens
}

/** `color.text_muted` -> `--hs-color-text-muted`. */
export function cssName(path: string): string {
    return '--hs-' + path.replaceAll('.', '-').replaceAll('_', '-')
}

/** Every token as [path, value]. Groups only: name, description and color_scheme are metadata. */
export function flatten(theme: ThemeTokens): [string, string][] {
    const out: [string, string][] = []
    for (const [group, members] of Object.entries(theme)) {
        if (typeof members === 'string') continue
        for (const [name, value] of Object.entries(members)) out.push([`${group}.${name}`, value])
    }
    return out
}

export function customProperties(theme: ThemeTokens): string {
    return flatten(theme)
        .map(([path, value]) => `${cssName(path)}:${value}`)
        .join(';')
}

/** Tokens the build reads by name, besides every `var(--hs-…)` the styles use. */
export const REQUIRED_TOKENS = [
    'color.background', 'color.surface', 'color.text', 'color.accent', 'font.display',
    'breakpoint.sm', 'breakpoint.md', 'breakpoint.lg',
]

/** Fonts pair with weights: each `font.X` needs `font_weight.X`; each `font_weight.X` needs `font.X` or `font.X` without `_strong`. */
export function assertFontTokens(key: string, theme: ThemeTokens): void {
    const fonts = (theme['font'] ?? {}) as Record<string, string>
    const weights = (theme['font_weight'] ?? {}) as Record<string, string>
    for (const role of Object.keys(fonts)) {
        if (weights[role] === undefined) throw new Error(`Theme "${key}" is missing token "font_weight.${role}"`)
    }
    for (const name of Object.keys(weights)) {
        const role = name.endsWith('_strong') ? name.slice(0, -'_strong'.length) : name
        if (fonts[role] === undefined) throw new Error(`Theme "${key}" has token "font_weight.${name}" but no token "font.${role}"`)
    }
}

/** Every theme must carry the same token set. Throws naming the theme and token. */
export function assertSameTokens(tokens: Tokens): void {
    const entries = Object.entries(tokens.themes)
    const first = entries[0]
    if (!first) throw new Error('design/tokens.json has no themes')
    for (const [key, theme] of entries) {
        const own = new Set(flatten(theme).map(([p]) => p))
        for (const p of REQUIRED_TOKENS) if (!own.has(p)) throw new Error(`Theme "${key}" is missing token "${p}"`)
        assertFontTokens(key, theme)
    }
    const reference = new Set(flatten(first[1]).map(([p]) => p))
    for (const [key, theme] of entries) {
        const own = new Set(flatten(theme).map(([p]) => p))
        for (const p of reference) if (!own.has(p)) throw new Error(`Theme "${key}" is missing token "${p}"`)
        for (const p of own) if (!reference.has(p)) throw new Error(`Theme "${key}" has token "${p}" that theme "${first[0]}" does not have`)
    }
}

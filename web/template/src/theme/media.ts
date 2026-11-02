import type { ThemeTokens } from './tokens.ts'

export type BreakpointName = 'sm' | 'md' | 'lg'

/** `atLeast('md', theme)` -> `(min-width:60rem)`. Takes the breakpoint name, never a literal. */
export function atLeast(name: BreakpointName, theme: ThemeTokens): string {
    const breakpoints = theme['breakpoint']
    const width = typeof breakpoints === 'object' ? breakpoints[name] : undefined
    if (width === undefined) throw new Error(`Theme has no breakpoint "${name}"`)
    return `(min-width:${width})`
}

/** Replaces `breakpoint(md)` in style sources with the media condition of the theme. */
export function resolveBreakpoints(css: string, theme: ThemeTokens): string {
    return css.replace(/breakpoint\(([^)]*)\)/g, (_, name: string) => {
        if (name !== 'sm' && name !== 'md' && name !== 'lg') throw new Error(`Unknown breakpoint "${name}"`)
        return atLeast(name, theme)
    })
}

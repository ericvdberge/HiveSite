export const THEME: string
export const tokensJsonPath: string
export const tokensCssPath: string
export const GAP_STAND_INS: Record<string, string>
export function varName(path: string): string
export function breakpoints(tokens: unknown, theme?: string): Record<string, string>
export function buildTokensCss(tokens: unknown, theme?: string): string
export function replaceBreakpoints(css: string, bps: Record<string, string>): string
export function breakpointPlugin(bps?: Record<string, string>): {
    postcssPlugin: string
    AtRule: { media: (rule: { params: string }) => void }
}

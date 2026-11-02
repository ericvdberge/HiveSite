import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildFiles, type ThemeRegistry } from '../src/build.ts'
import type { RenderRequest } from '../src/request.ts'
import { buildThemes } from '../src/theme/build.ts'
import { loadTokens } from '../src/theme/tokens.ts'

export const THEMES = ['atelier', 'ivory', 'studio']

/** Builds the themes once per test file, to a temp folder, as `npm run build` does. */
export function buildThemeOutput(): { dir: string; registry: ThemeRegistry } {
    const dir = mkdtempSync(join(tmpdir(), 'hs-template-'))
    buildThemes(loadTokens(), dir)
    return { dir, registry: JSON.parse(readFileSync(join(dir, 'themes.json'), 'utf8')) as ThemeRegistry }
}

export const { registry } = buildThemeOutput()

export async function render(request: RenderRequest): Promise<Record<string, string>> {
    const files = await buildFiles(request, registry)
    return Object.fromEntries(files.map((f) => [f.path, f.html]))
}

export async function renderOne(request: RenderRequest): Promise<string> {
    const files = await render(request)
    const html = Object.values(files)[0]
    if (html === undefined) throw new Error('no file')
    return plain(html)
}

export const stylesheetOf = (theme: string): string => registry.themes.find((t) => t.key === theme)?.assets.stylesheet ?? ''

/** The HTML without Vue's comment markers, for assertions on structure. */
export const plain = (html: string): string => html.replace(/<!--.*?-->/g, '')

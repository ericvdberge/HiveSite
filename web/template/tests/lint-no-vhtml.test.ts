import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url))
const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dir, e.name)) : [join(dir, e.name)]))

describe('source rules', () => {
    it('never uses v-html or innerHTML_AC14', () => {
        const files = [...sources(here('../src')), ...sources(here('../../packages/blocks/src'))]
        expect(files.length).toBeGreaterThan(10)
        for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/v-html|innerHTML|outerHTML|insertAdjacentHTML/)
    })

    it('reads no clock, randomness, environment, network or files in the entry and the build_AC4', () => {
        const sourcesOfBuild = ['render.ts', 'build.ts', 'request.ts', 'links.ts', 'context.ts', 'strings.ts'].map((f) => here(`../src/${f}`))
        const forbidden = /Date\b|Math\.random|crypto|process\.env|performance\.|fetch\(|node:fs|node:http|node:net|import\(|require\(/
        for (const file of sourcesOfBuild) expect(readFileSync(file, 'utf8'), file).not.toMatch(forbidden)
    })
})

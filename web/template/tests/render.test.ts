import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'
import { renderBundle } from '../vite.config.ts'
import { atelierNoor, heroFixtures, preview, release } from './fixtures/snapshots.ts'
import { buildThemeOutput } from './helpers.ts'

let bundle: string
let isolated: string
beforeAll(async () => {
    const { dir } = buildThemeOutput()
    await build({ ...renderBundle(dir, join(dir, 'themes.json')), configFile: false })
    bundle = join(dir, 'render.mjs')
    // AC18: the bundle alone, in a directory without node_modules.
    isolated = mkdtempSync(join(tmpdir(), 'hs-isolated-'))
    copyFileSync(bundle, join(isolated, 'render.mjs'))
}, 120_000)

const run = (input: string, file = bundle, env: NodeJS.ProcessEnv = process.env) =>
    spawnSync(process.execPath, [file], { input, env, encoding: 'utf8', cwd: tmpdir(), maxBuffer: 64 * 1024 * 1024 })

const snapshot = atelierNoor(heroFixtures['image']!)
const files = (stdout: string): { path: string; html: string }[] => (JSON.parse(stdout) as { files: { path: string; html: string }[] }).files

describe('render.mjs', () => {
    it('writes the one page of a preview request_AC1', () => {
        const result = run(JSON.stringify(preview(snapshot)))
        expect(result.status).toBe(0)
        const out = files(result.stdout)
        expect(out.map((f) => f.path)).toEqual(['/our-work'])
        expect(out[0]?.html.startsWith('<!doctype html>')).toBe(true)
        expect(files(run(JSON.stringify(preview(snapshot, '01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0'))).stdout).map((f) => f.path)).toEqual(['/'])
        expect(Object.keys(JSON.parse(result.stdout) as object)).toEqual(['files'])
    })

    it('writes the home page, every page and the not-found page in release mode_AC2', () => {
        const result = run(JSON.stringify(release(snapshot)))
        expect(result.status).toBe(0)
        expect(files(result.stdout).map((f) => f.path)).toEqual(['/', '/about', '/our-work', '/404.html'])
    })

    it('exits non-zero with a reason and no stdout on a bad request_AC3', () => {
        const bad = [
            'not json',
            JSON.stringify({ ...preview(snapshot), snapshot: { ...snapshot, snapshot_format: 2 } }),
            JSON.stringify({ ...preview(snapshot), mode: 'live' }),
            JSON.stringify(preview(snapshot, 'not-a-page')),
            JSON.stringify(preview(atelierNoor([{ type: 'marquee' }]))),
        ]
        for (const input of bad) {
            const result = run(input)
            expect(result.status, input.slice(0, 40)).not.toBe(0)
            expect(result.stdout).toBe('')
            expect(result.stderr.length).toBeGreaterThan(0)
            expect(result.stderr.length).toBeLessThan(300)
        }
    })

    it('gives the same bytes in any environment_AC4', () => {
        const input = JSON.stringify(release(snapshot))
        const first = run(input).stdout
        expect(first.length).toBeGreaterThan(0)
        expect(run(input).stdout).toBe(first)
        expect(run(input, bundle, { TZ: 'Pacific/Auckland', LANG: 'tr_TR.UTF-8' }).stdout).toBe(first)
        expect(run(input, bundle, {}).stdout).toBe(first)
    })

    it('runs without node_modules next to it_AC18', () => {
        const result = run(JSON.stringify(release(snapshot)), join(isolated, 'render.mjs'))
        expect(result.status).toBe(0)
        expect(result.stdout).toBe(run(JSON.stringify(release(snapshot))).stdout)
        expect(readFileSync(join(isolated, 'render.mjs'), 'utf8')).not.toMatch(/from ["']vue["']/)
    })
})

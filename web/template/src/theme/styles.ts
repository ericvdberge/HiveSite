import { readdirSync, readFileSync } from 'node:fs'
import type { StyleSource } from './build.ts'

const read = (dir: URL, file: string): string => readFileSync(new URL(file, dir), 'utf8')
const readAll = (dir: URL): string =>
    readdirSync(dir)
        .filter((f) => f.endsWith('.css'))
        .sort((a, b) => Number(b === 'shared.css') - Number(a === 'shared.css') || (a < b ? -1 : a > b ? 1 : 0))
        .map((f) => read(dir, f))
        .join('\n')

const shellDir = new URL('../styles/', import.meta.url)
const blocksDir = new URL('../../../packages/blocks/src/styles/', import.meta.url)

/** The page shell, then the styles of `@hivesite/blocks` (shared rules first, then one file per block). */
export const shellStyles: StyleSource = () => read(shellDir, 'shell.css')
export const blockStyles: StyleSource = () => readAll(blocksDir)

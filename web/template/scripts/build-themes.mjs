// Writes dist/themes/{key}/ and dist/themes.json from design/tokens.json.
// Usage: node scripts/build-themes.mjs [outDir]
import { fileURLToPath } from 'node:url'
import { buildThemes } from '../src/theme/build.ts'
import { loadTokens } from '../src/theme/tokens.ts'

const out = process.argv[2] ?? fileURLToPath(new URL('../dist', import.meta.url))
try {
    buildThemes(loadTokens(), out)
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
}

// Entry of dist/render.mjs: one JSON request on stdin, one JSON response on stdout.
// Reads nothing else: no clock, no randomness, no environment, no network, no files.
import registry from 'hivesite-themes'
import { buildFiles } from './build.ts'
import { parseRequest } from './request.ts'

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks).toString('utf8')
}

try {
    const request = parseRequest(await readStdin())
    const files = await buildFiles(request, registry)
    process.stdout.write(JSON.stringify({ files }))
} catch (error) {
    process.stderr.write(`render failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
}

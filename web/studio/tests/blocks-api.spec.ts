import { describe, expect, it, vi } from 'vitest'

// The typed client captures fetch when it is created, so the stub is installed before imports run.
const fetchMock = vi.hoisted(() => {
    const fn = vi.fn()
    globalThis.fetch = fn as unknown as typeof fetch
    return fn
})

import { getPageBlocks, listAllBlockTypes } from '../src/api'

const json = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json', ...headers },
    })

describe('block helpers', () => {
    it('(AC1) getPageBlocks returns the document and the ETag from the raw response', async () => {
        fetchMock.mockResolvedValue(json({ type: 'doc', content: [] }, { ETag: '"7"' }))
        const result = await getPageBlocks('p1')
        expect(result.document.content).toEqual([])
        expect(result.etag).toBe('"7"')
    })

    it('(AC1) listAllBlockTypes follows next_cursor until it is null', async () => {
        const type = (t: string) => ({ type: t, name: t, description: '', version: 1, schema: {} })
        fetchMock
            .mockResolvedValueOnce(json({ items: [type('hero')], next_cursor: 'c2' }))
            .mockResolvedValueOnce(json({ items: [type('embed')], next_cursor: null }))
        const all = await listAllBlockTypes()
        expect(all.map((t) => t.type)).toEqual(['hero', 'embed'])
    })
})

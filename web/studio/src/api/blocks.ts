import { api } from './client'
import { ApiError, UNKNOWN_ERROR_CODE } from './errors'
import { listAll } from './pagination'
import type { components } from './schema'

export type BlockTypeInfo = components['schemas']['BlockTypeDto']
export type BlocksDocumentDto = components['schemas']['PageBlocksDocumentDto']

/**
 * The blocks document of a page and its `ETag` (API-004). The generated types do not declare
 * the header, so it is read from the raw response. `etag` is `null` when the header is absent.
 */
export async function getPageBlocks(
    id: string,
    signal?: AbortSignal,
): Promise<{ document: BlocksDocumentDto; etag: string | null }> {
    const { data, response } = await api.GET('/pages/{id}/blocks', {
        params: { path: { id } },
        signal,
    })
    if (!data) throw new ApiError(UNKNOWN_ERROR_CODE, 'Something went wrong. Try again.')
    return { document: data, etag: response.headers.get('ETag') }
}

/** Every block type (API-003), following `next_cursor` until it is `null`. */
export function listAllBlockTypes(signal?: AbortSignal): Promise<BlockTypeInfo[]> {
    return listAll<BlockTypeInfo>(async (cursor) => {
        const { data } = await api.GET('/block-types', {
            params: { query: cursor ? { cursor } : {} },
            signal,
        })
        if (!data) throw new ApiError(UNKNOWN_ERROR_CODE, 'Something went wrong. Try again.')
        return data
    })
}

async function replace(
    id: string,
    document: BlocksDocumentDto,
    headers: Record<string, string>,
    signal?: AbortSignal,
): Promise<{ document: BlocksDocumentDto; etag: string | null }> {
    const { data, response } = await api.PUT('/pages/{id}/blocks', {
        params: { path: { id } },
        body: document,
        headers,
        signal,
    })
    if (!data) throw new ApiError(UNKNOWN_ERROR_CODE, 'Something went wrong. Try again.')
    return { document: data, etag: response.headers.get('ETag') }
}

/**
 * Replaces the blocks of a page (API-004) with `If-Match` set by hand to the last `ETag`, because
 * the generated types do not declare the header. The `etag` is required: a normal save never goes
 * without a known version. Returns the stored document and its new `ETag` (`null` if unreadable).
 */
export function putPageBlocks(
    id: string,
    document: BlocksDocumentDto,
    etag: string,
    signal?: AbortSignal,
) {
    return replace(id, document, { 'If-Match': etag }, signal)
}

/** The deliberate overwrite: no `If-Match`, last write wins. Only the changed-elsewhere dialog calls it. */
export function overwritePageBlocks(id: string, document: BlocksDocumentDto, signal?: AbortSignal) {
    return replace(id, document, {}, signal)
}

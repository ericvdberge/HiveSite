export interface Page<T> {
    items: T[]
    next_cursor?: string | null
}

/** Follows `next_cursor` until it is `null` and returns every item, in list order. */
export async function listAll<T>(
    fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
): Promise<T[]> {
    const items: T[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    for (;;) {
        const page = await fetchPage(cursor)
        items.push(...page.items)
        if (page.next_cursor == null) return items
        if (seen.has(page.next_cursor)) {
            throw new Error('The list cursor did not advance.')
        }
        seen.add(page.next_cursor)
        cursor = page.next_cursor
    }
}

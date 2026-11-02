/** Length in code points after trimming, the count the server uses (API-001, API-003). */
export function count(value: string): number {
    return [...value.trim()].length
}

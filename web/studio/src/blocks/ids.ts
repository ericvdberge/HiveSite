/** The element id of a field: the block's id and its path inside `attrs` (`image.url` -> `b1-image-url`). */
export function fieldId(blockId: string, path: string): string {
    return `${blockId}-${path.replaceAll('.', '-')}`
}

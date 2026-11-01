/**
 * Maps `error.field` to a form field key.
 * - A JSON Pointer into the body (`/settings/description`) becomes a dotted key (`settings.description`).
 * - A query parameter or header name (`limit`) is returned as it is.
 * - No field means no single input is to blame: `undefined`.
 */
export function fieldKey(field: string | undefined | null): string | undefined {
    if (!field) return undefined
    if (!field.startsWith('/')) return field
    const keys = field
        .slice(1)
        .split('/')
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    return keys.join('.')
}

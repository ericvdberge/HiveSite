// Rules of the site form (design/studio/site-form.md, API-001 Rules: Site fields).

export const LIMITS = { name: 80, slug: 40, language: 35, description: 160 } as const
export const DEFAULT_LANGUAGE = 'en'

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export type FieldName = 'name' | 'slug' | 'language' | 'description'
export const FIELD_ORDER: FieldName[] = ['name', 'slug', 'language', 'description']

/** Length in code points after trimming, the count the server uses. */
export function count(value: string): number {
    return [...value.trim()].length
}

/** Copy for a broken client rule, or '' when the value is fine. */
export function checkField(field: FieldName, raw: string): string {
    const n = count(raw)
    const value = raw.trim()
    switch (field) {
        case 'name':
            if (n === 0) return 'Enter a name.'
            return n > LIMITS.name ? 'Use 80 characters or fewer.' : ''
        case 'slug':
            if (n < 3) return 'Use at least 3 characters.'
            if (n > LIMITS.slug) return 'Use 40 characters or fewer.'
            return SLUG_PATTERN.test(value)
                ? ''
                : 'Use lowercase letters, digits and hyphens, starting and ending with a letter or digit.'
        case 'language':
            if (n === 0) return ''
            return n >= 2 && n <= LIMITS.language && LANGUAGE_PATTERN.test(value)
                ? ''
                : 'Use a language tag such as en, nl or pt-BR.'
        case 'description':
            return n > LIMITS.description ? 'Use 160 characters or fewer.' : ''
    }
}

/** Slug suggested from a name: ASCII, hyphens between words, at most 40; '' when under 3. */
export function suggestSlug(name: string): string {
    const hyphenate = (s: string) => s.replace(/^-+|-+$/g, '')
    const base = hyphenate(
        name
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-'),
    )
    const slug = hyphenate(base.slice(0, LIMITS.slug))
    return slug.length < 3 ? '' : slug
}

/** Server copy for `invalid_request` on a field (site-form.md, Server errors). */
export const SERVER_FIELD_COPY: Record<FieldName, string> = {
    name: 'Use 1 to 80 characters.',
    slug: 'Use 3 to 40 characters: lowercase letters, digits and hyphens.',
    language: 'Use a language tag such as en, nl or pt-BR.',
    description: 'Use 160 characters or fewer.',
}

/** Maps a form key from `fieldKey()` to a field of this form, or undefined. */
export function formField(key: string | undefined): FieldName | undefined {
    switch (key) {
        case 'name':
        case 'slug':
            return key
        case 'settings.language':
            return 'language'
        case 'settings.description':
            return 'description'
        default:
            return undefined
    }
}

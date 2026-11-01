// Rules of the page form (design/studio/page-form.md, API-002 Rules: Page fields).
// Mirrors siteForm.ts (#61) for pages; to be merged into one helper later.

export const LIMITS = { title: 80, slug: 60 } as const
export const RESERVED_SLUG = 'assets'

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type FieldName = 'title' | 'slug'
export const FIELD_ORDER: FieldName[] = ['title', 'slug']

const RESERVED_COPY = "The slug assets is kept for your site's files. Please choose another."

/** Length in code points after trimming, the count the server uses. */
export function count(value: string): number {
    return [...value.trim()].length
}

/** Copy for a broken client rule, or '' when the value is fine. */
export function checkField(field: FieldName, raw: string): string {
    const n = count(raw)
    const value = raw.trim()
    if (field === 'title') {
        if (n === 0) return 'Enter a title.'
        return n > LIMITS.title ? 'Use 80 characters or fewer.' : ''
    }
    if (n === 0) return 'Enter a slug.'
    if (n > LIMITS.slug) return 'Use 60 characters or fewer.'
    if (!SLUG_PATTERN.test(value)) {
        return 'Use lowercase letters, digits and hyphens, starting and ending with a letter or digit.'
    }
    return value === RESERVED_SLUG ? RESERVED_COPY : ''
}

/** Slug suggested from a title: ASCII, hyphens between words, at most 60; '' when empty. */
export function suggestSlug(title: string): string {
    const hyphenate = (s: string) => s.replace(/^-+|-+$/g, '')
    const base = hyphenate(
        title
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-'),
    )
    return hyphenate(base.slice(0, LIMITS.slug))
}

/** Server copy (page-form.md, Server errors). */
export const SERVER_FIELD_COPY: Record<FieldName, string> = {
    title: 'Use 1 to 80 characters.',
    slug: 'Use 1 to 60 characters: lowercase letters, digits and hyphens.',
}
export const SLUG_TAKEN_COPY =
    'Another page of this site already uses this slug. Try a different one.'
export const SLUG_RESERVED_COPY = RESERVED_COPY
export const TOO_MANY_COPY = "This site has 50 pages, the most it can hold. This page wasn't added."
export const NOT_ACCEPTED_COPY =
    "Something in the form wasn't accepted. Please check it and try again."

/** Maps a form key from `fieldKey()` to a field of this form, or undefined. */
export function formField(key: string | undefined): FieldName | undefined {
    return key === 'title' || key === 'slug' ? key : undefined
}

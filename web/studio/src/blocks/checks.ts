// Pure client checks and their copy (block-editor.md, Errors). Lengths count code points after
// trimming. Each check returns the copy of the broken rule, or '' when the value is fine.

import { count } from '../text'

export function checkRequired(label: string, value: string): string {
    return count(value) === 0 ? `Enter a ${label.toLowerCase()}.` : ''
}

export function checkMax(value: string, max: number): string {
    return count(value) > max ? `Use ${max} characters or fewer.` : ''
}

/** A required string: present, then within its maximum. */
export function checkText(label: string, value: string, max: number): string {
    return checkRequired(label, value) || checkMax(value, max)
}

// `$defs/url` and `$defs/link` in API-003, with a host required after `https://`.
const URL_PATTERN = /^https:\/\/[^\s/?#]+[^\s]*$/
const LINK_PATTERN =
    /^(https:\/\/[^\s/?#]+[^\s]*|mailto:[^\s]+|\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?)$/

export const URL_COPY = 'Use an address that starts with https://, with no spaces.'
export const LINK_COPY =
    'Use a page path such as /about, an address that starts with https://, or a mailto: address.'

/** A required `$defs/url`; empty fails the pattern and gets its copy. */
export function checkUrl(value: string, max: number): string {
    const v = value.trim()
    return checkMax(v, max) || (URL_PATTERN.test(v) ? '' : URL_COPY)
}

/** A required `$defs/link`; empty fails the pattern and gets its copy. */
export function checkLink(value: string, max: number): string {
    const v = value.trim()
    return checkMax(v, max) || (LINK_PATTERN.test(v) ? '' : LINK_COPY)
}

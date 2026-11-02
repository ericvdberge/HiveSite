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

// Embed hosts per provider (API-003, Rules beyond the schemas). The server enforces them; these
// mirror them for early feedback. Hosts compare ignoring case.
const EMBED_RULES: Record<string, { hosts: string[]; pathPrefix?: string; copy: string }> = {
    youtube: {
        hosts: ['www.youtube.com', 'youtube.com', 'youtu.be'],
        copy: 'Use a YouTube address.',
    },
    vimeo: { hosts: ['vimeo.com', 'player.vimeo.com'], copy: 'Use a Vimeo address.' },
    google_maps: {
        hosts: ['www.google.com'],
        pathPrefix: '/maps/embed',
        copy: 'Use a Google Maps embed address.',
    },
}

export const PROVIDER_COPY = 'Choose a provider.'

function ruleOf(provider: string) {
    return Object.prototype.hasOwnProperty.call(EMBED_RULES, provider)
        ? EMBED_RULES[provider]
        : undefined
}

/** No provider, or a value that is not one of the three: "Choose a provider." */
export function checkProvider(provider: string): string {
    return ruleOf(provider) ? '' : PROVIDER_COPY
}

/** A valid https:// address that is not of its provider gets the provider's copy. */
export function checkEmbedUrl(provider: string, value: string, max: number): string {
    const base = checkUrl(value, max)
    const rule = ruleOf(provider)
    if (base || !rule) return base
    let url: URL
    try {
        url = new URL(value.trim())
    } catch {
        return URL_COPY
    }
    const hostOk = rule.hosts.includes(url.hostname.toLowerCase())
    const pathOk = !rule.pathPrefix || url.pathname.toLowerCase().startsWith(rule.pathPrefix)
    return hostOk && pathOk ? '' : rule.copy
}

/** The hint under an embed address, by provider. */
export function embedUrlHint(provider: string): string {
    switch (provider) {
        case 'youtube':
            return 'A youtube.com or youtu.be address.'
        case 'vimeo':
            return 'A vimeo.com address.'
        case 'google_maps':
            return 'In Google Maps choose Share, then Embed a map, and copy the address that starts with https://www.google.com/maps/embed.'
        default:
            return 'Choose a provider first.'
    }
}

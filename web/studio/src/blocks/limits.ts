// The hero limits in the form. A test reads Content's hero.json and defs.json and fails when
// these drift from the server (API-003).

export const HERO_LIMITS = {
    title: 80,
    subtitle: 160,
    imageAlt: 200,
    ctaLabel: 30,
} as const

/** `$defs/url` and `$defs/link`. */
export const URL_MAX = 2048

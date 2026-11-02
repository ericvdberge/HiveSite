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

/** The image block (`image.json`; the alt text limit is `$defs/image`, see HERO_LIMITS.imageAlt). */
export const IMAGE_LIMITS = { caption: 200 } as const
export const IMAGE_WIDTHS = ['content', 'wide', 'full'] as const

/** The embed block (`embed.json`). */
export const EMBED_LIMITS = { title: 120 } as const
export const EMBED_PROVIDERS = ['youtube', 'vimeo', 'google_maps'] as const
export const EMBED_ASPECT_RATIOS = ['16:9', '4:3', '1:1'] as const

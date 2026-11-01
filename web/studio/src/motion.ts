// Motion helpers. Durations and easing are read from the design tokens (custom properties),
// so reduced motion (which sets the duration token to 0ms) needs no second code path.

function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** `motion.duration_base` in milliseconds; 0 under reduced motion. */
export function baseDuration(): number {
    const raw = cssVar('--hs-motion-duration-base')
    const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000
    return Number.isFinite(ms) ? ms : 0
}

type EasingToken = '--hs-motion-easing-standard' | '--hs-motion-easing-enter'

/** Plays a keyframe animation over `motion.duration_base`; resolves when it ends. Skipped when 0 or unsupported. */
export async function play(
    el: HTMLElement,
    keyframes: Keyframe[],
    easingToken: EasingToken = '--hs-motion-easing-standard',
): Promise<void> {
    const duration = baseDuration()
    if (duration <= 0 || typeof el.animate !== 'function') return
    const animation = el.animate(keyframes, {
        duration,
        easing: cssVar(easingToken) || 'ease',
    })
    try {
        await animation.finished
    } catch {
        /* cancelled: the element left the page */
    }
}

/** Glides an element from where it was (`fromTop`) to where it is now. */
export function glide(el: HTMLElement, fromTop: number): Promise<void> {
    const delta = fromTop - el.getBoundingClientRect().top
    if (!delta) return Promise.resolve()
    return play(el, [{ transform: `translateY(${delta}px)` }, { transform: 'none' }])
}

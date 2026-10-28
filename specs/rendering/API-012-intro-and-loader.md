---
id: API-012
title: Intro and loader on published sites
domain: rendering
status: in review
owner: api-architect
stories: [22]
depends_on: [API-010, API-011, API-021]
version: 1
---

## Purpose
A visitor of a published site sees the Hivesite intro, the golden thread, once per visit, with the loader while the page gets ready. Nobody gets motion who asked for less.

This spec adds to the `release` output of API-011. It has no HTTP endpoint of its own: the files it adds are served by API-021.

## Endpoints

None. The script and the mark ship inside every release as `assets/hivesite.{hash}.js` and inline SVG, and are served by `GET /s/{site_slug}/{path}` (API-021):

Request
```
GET /s/atelier-noor/assets/hivesite.0c41d9e7.js
```

Response 200

Headers: `Content-Type: text/javascript; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`
```js
(()=>{"use strict";const d=document.documentElement;…})();
```

Errors
- 404 as in API-021, for a name the release does not have.

## Markup
API-011's `release` HTML gains three things. `preview` mode gains none of them.

1. In `<head>`, after the stylesheet: `<script src="{prefix}assets/hivesite.{hash}.js"></script>`. It is not `defer` or `async`: it must run before first paint to decide whether the veil shows, and it waits for `DOMContentLoaded` for the rest.
2. In the header, before the site name: the Hivesite mark, inline:
   ```html
   <span class="hs-mark" role="img" aria-label="Made with Hivesite"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path class="hs-mark__hex" d="M12 1.5 21.1 6.75v10.5L12 22.5 2.9 17.25V6.75Z"/><path class="hs-mark__h" d="M8.5 7.5v9M15.5 7.5v9M8.5 12h7"/></svg></span>
   ```
   The `aria-label` is localised: `nl` gets `Gemaakt met Hivesite` (API-011 Strings).
3. Nothing else. The page is complete and visible without the script.

The exact SVG paths come from `design/brand/` (#10); the shape above is the placeholder until that lands, and a change to it is a new version of this spec.

## The intro
The script plays the golden thread from `docs/plan.html`, in three beats, with the times measured from the start:

| Time | Beat |
|---|---|
| 0 – 0.85 s | Light traces the hexagon (sine ease), large and centred on a `color.background` veil. |
| 0.7 – 1.1 s | Gold fill (`color.accent`) and the H appear. |
| 1.25 – 2.0 s | The mark glides into its place in the header (`.hs-mark`); the veil fades and the site appears around it. |
| 1.7 – 2.7 s | The first blocks settle, 70 ms apart, each over 400 ms. |

- Total length 2.7 s. Every single motion takes at least 300 ms. One shape moves at a time; there are no flashes; every motion ends where the next one starts.
- Blocks that settle: at most the first 6 blocks that are in the viewport when the intro starts. Later blocks are shown without motion.
- Colors, easing and durations come from the theme's tokens (`color.*`, `motion.*`). The script reads them from the CSS custom properties; it contains no color or font values.

### When it plays
- On the first page view of a browser session on that site: the script keeps `hs-intro-seen` in `sessionStorage`. Later page views in the same session show the page at once.
- Not when `prefers-reduced-motion: reduce` matches. The page shows at once with the mark already in place.
- Not when `sessionStorage` cannot be read or written; then the page never plays it, rather than playing it on every view.
- Not on the not-found page.
- A click, a key press or a scroll during the intro ends it at once: the veil goes and the page is shown as it is at the end.

### The loader
- The page is ready when the stylesheet's fonts have loaded (`document.fonts.ready`) and every image in block 0 has loaded or failed.
- If the page is not ready when beat 1 ends at 0.85 s, beat 1 repeats as the loader, the same hexagon and light drawn and released in a 2 s loop, until it is ready. Then beat 2 starts from where the loop is.
- After 4 s in total the intro moves on, ready or not.
- With reduced motion, the loader is the static mark; nothing loops.
- The loader is also available as `.hs-loader` in the theme stylesheet (24 px and 64 px) for later use in the admin. It is not used anywhere else in this version.

### No script, no harm
- The content is never hidden by the HTML or the stylesheet alone. The script adds `class="hs-intro"` to `<html>` before first paint and removes it at the end; the veil exists only under that class.
- If the script fails to load or throws, the site shows as if the intro had already played.

## Rules

### Limits
- `hivesite.{hash}.js`: at most 8 KB minified (before compression). No dependencies, no network requests, no cookies, no `localStorage`.
- The script is the same for every site and theme. It is added to each release by `RenderSite` like the theme's other assets (API-010 Assets): the same naming, `^[a-z0-9-]+\.[0-9a-f]{8}\.js$`, content type `text/javascript; charset=utf-8`.
- The inline mark is at most 1 KB.

### Determinism
- `RenderSite` stays pure: the script file is a constant of the build, and the HTML is still the same for the same snapshot. Snapshot tests cover the added `<script>` and mark.
- Timing and the session check happen in the browser only.

### Security
- Fits API-011's Content-Security-Policy unchanged: `script-src 'self'` allows the release's own script, and there is still no inline script.

### Accessibility
- The veil has `aria-hidden="true"`. The intro never moves focus and never traps it; the skip link works during the intro.
- The intro does not delay content for assistive technology: the DOM is complete from the first byte.

## Decisions
- **No HTTP endpoint and no owner setting.** The intro is on for every published site. A switch to turn it off (for example in a premium tier) is a later story.
- **Once per browser session per site,** not once ever. A returning visitor sees the brand again on a new visit, but never while browsing.
- **The script is part of every release.** Rolling back to an old release gives the intro as it was then, like the theme.
- **Preview has no intro.** Owners preview many times; the label "Preview" stays the only addition there.
- **The loader doubles as the intro's first beat** instead of a separate spinner, so a slow page shows one continuous shape.

## Open questions
- none

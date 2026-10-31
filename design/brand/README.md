# Brand

The Hivesite mark, lockups and motion samples, as standalone files to copy. Taken from `docs/plan.html`, sections 01 Brand and 02 Motion.

Quiet luxury, built by many. *Crafted by many. Made for you.*

## Files

| File | Use |
|---|---|
| `logo-mark.svg` | The mark alone: hexagon, inner hexagon and H in Champagne. On dark backgrounds. Favicons, avatars, small spaces. |
| `lockup-dark.svg` | Mark, wordmark `HIVESITE` and tagline, stacked. On dark backgrounds. Covers, title slides, splash screens. |
| `lockup-light.svg` | Filled Bronze hexagon with an Ivory H, wordmark `Hivesite`, side by side. On light backgrounds. Headers, documents, email. |
| `intro.html` | The 2.7 s intro: the light draws the mark, the mark glides into the nav, the site appears. Plays once on load, "Play again" restarts it. |
| `loader.html` | The loader, in a 2.2 s loop, for use **while a site renders or publishes**. Also the 24 px version for buttons. |
| `check-brand.mjs` | Checks these files. See [Checks](#checks). |
| `fixtures/failing/` | Files that break every rule `check-brand.mjs` checks. The check must fail on them. |

Both HTML files are self-contained: no external scripts, styles, fonts or images, no build step. Open them straight from disk.

## Which lockup where

| Background | Use | Do not use |
|---|---|---|
| Dark: Ink `#100E0B`, Panel `#17140F` | `lockup-dark.svg`, `logo-mark.svg` | `lockup-light.svg` (the Ink wordmark disappears) |
| Light: Ivory `#F5F1E8`, white | `lockup-light.svg` | `lockup-dark.svg`, `logo-mark.svg` (the Ivory wordmark and the thin Champagne lines fade out) |
| Photo or busy image | Neither directly. Put the lockup on a solid Ink or Ivory panel first. | |

The SVGs are transparent: they carry no background of their own. Do not recolor, stretch, outline or add effects.

## Colors and type

Only the six brand colors appear in these files: Ink `#100E0B`, Panel `#17140F`, Champagne `#CDAE74`, Bronze `#94733A`, Ivory `#F5F1E8`, Stone `#A69D8C`. plan.html also uses `#f2ece0`, `#3a3326` and `#f6e2b3`; here they are Ivory, Bronze at 50% opacity and Ivory.

Type: Cormorant Garamond (wordmark, H, tagline), Hanken Grotesk (text), IBM Plex Mono (labels). The files do not load fonts; SVG text falls back to Georgia, then serif. For a pixel-exact mark in production, convert the text to outlines once the font is licensed and hosted (out of scope here).

These samples use the fixed brand palette, not the theme tokens in `design/tokens.json`.

### Contrast

| Pair | Ratio | Where |
|---|---|---|
| Ivory on Ink | 17.1:1 | dark wordmark, headings |
| Ivory on Panel | 16.3:1 | button label in the loader sample |
| Ink on Ivory | 17.1:1 | light wordmark |
| Champagne on Ink | 9.1:1 | mark, eyebrow, button edge |
| Champagne on Panel | 8.7:1 | mark on the stage |
| Ink on Champagne | 9.1:1 | the H in the filled mark, button label in the intro |
| Stone on Ink | 7.2:1 | tagline |
| Stone on Panel | 6.8:1 | "Building your site…", notes |
| Ivory on Bronze | 3.9:1 | the H in the light lockup (a logotype, exempt under WCAG 1.4.3; still above 3:1) |
| Bronze on Ivory | 3.9:1 | the light mark as a graphic (WCAG 1.4.11 asks 3:1) |

## Motion rules

From plan.html, for all Hivesite motion:

- **One shape at a time.** A new shape starts moving only as the one before it lands. Every overlap is listed below with its reason.
- **No flashes.** No opacity or color changes more than 3 times per second. Every fade is one direction over at least 300 ms; the loader fades the fill in and out once per 2.2 s.
- **Slow in, slow out.** All steps use a cubic in-out ease (`io`), the trace a sine ease. Nothing is linear, nothing bounces.
- **Nothing faster than 300 ms.** Every step's duration is in a `DURATIONS` table at the top of each script, and `check-brand.mjs` fails on any step under 300 ms. The 70 ms block stagger is a delay between starts, not a duration.
- **Every motion ends where the next one starts.** Each step picks up the exact position and opacity the previous one left.
- **Always a reduced-motion fallback.** See [Reduced motion](#reduced-motion).

### Intro, 2.7 s

| Time | Step | `DURATIONS` key |
|---|---|---|
| 0–0.3 s | the light fades in as it sets off | `lightIn` |
| 0–0.85 s | the light traces the hexagon, sine ease | `trace` |
| 0.7–1.05 s | gold fill | `fill` |
| 0.8–1.1 s | the H appears | `letter` |
| 0.85–1.15 s | the light fades out | `lightOut` |
| 1.25–2 s | the logo glides to the nav | `glide` |
| 1.45–2 s | the site fades in | `site` |
| 1.7–2.7 s | five blocks settle, 70 ms between starts, 0.72 s each (last starts 1.98 s, ends 2.7 s) | `block`, `STAGGER_MS` |

The four beats from plan.html: trace the hexagon 0–0.85 s; fill and H 0.7–1.1 s; logo glides and site fades in 1.25–2 s; blocks settle 1.7–2.7 s with 70 ms between starts. Total 2.7 s (`TOTAL_MS`).

### Loader, 2.2 s loop

plan.html uses 2.2 s; so does `loader.html` (`CYCLE_MS = 2200`).

| Time in loop | Step | `DURATIONS` key |
|---|---|---|
| 0–0.3 s | the light fades in as it sets off | `lightIn` |
| 0–0.99 s | the light traces the hexagon, sine ease | `trace` |
| 0.99–1.29 s | the light fades out where the trace ends | `lightOut` |
| 0.99–1.32 s | the fill and the H appear | `fill` |
| 1.32–1.65 s | still | |
| 1.65–2.2 s | the fill fades out and the stroke unwinds | `release` |

The **24 px** version is the same loop on a 24 × 24 viewBox with no text label, a heavier stroke (1.6), a bolder, larger H and a smaller light, so it stays legible as a button spinner. Its own SVG, not the large one scaled down.

### Changes from plan.html

plan.html breaks the 300 ms rule in three places. These files lengthen them:

| Step | plan.html | Here |
|---|---|---|
| Intro: light fade-out | 200 ms | 300 ms (`lightOut`) |
| Loader: light fade-in | about 110 ms | 300 ms (`lightIn`) |
| Loader: light fade-out | about 275 ms | 300 ms (`lightOut`) |

Two more changes, both inside the stated beats:

- The intro light appeared instantly in plan.html. It now fades in over 300 ms (`lightIn`), so it is not a flash.
- Each intro block settled in 450 ms, so the last block landed at 2.43 s and the timeline then held still to 2.7 s. Blocks now take 720 ms, so the block beat runs 1.7–2.7 s as plan.html states.

### Where two shapes move at once

Shapes: the **light**, the **mark** (hexagon stroke, fill and H) and the **site** (frame, nav and blocks).

Intro:

1. **Light and stroke, 0–0.85 s.** One gesture: the light is the tip of the line it draws. The light's fade-in (0–0.3 s) is the same shape appearing as it moves.
2. **Fill and H start at 0.7 s and 0.8 s, before the trace ends at 0.85 s.** The fill, the H and the stroke are all the mark, one shape. The fill begins as the line closes so the mark lands as one.
3. **Light fade-out (0.85–1.15 s) with the fill and H (to 1.1 s).** The light starts leaving exactly where the trace ends, as the mark it drew fills in: a hand-over, not a second motion. Both are still by 1.15 s and nothing else starts until the glide at 1.25 s.
4. **Glide (1.25–2 s) with the site fade (1.45–2 s).** The site is the ground the logo lands in. It starts after the glide is under way and both end at 2 s: the glide ends where the site is complete.
5. **Blocks (1.7–2.7 s) with the glide and site (to 2 s), and with each other.** The blocks are part of the site, settling as it reaches full opacity. They are one group in a 70 ms cascade, not five separate motions.

Loader:

1. **Light and stroke, 0–0.99 s.** One gesture, as in the intro.
2. **Light fade-out with the fill and H, both from 0.99 s.** Both start where the trace ends: the light hands the mark over. The fill and H are one shape.
3. **Fill fade-out and stroke unwind, 1.65–2.2 s.** One shape, the mark, leaving.

The sample page shows the large loader and two 24 px loaders on one clock to compare them. In a product, show one loader at a time.

## Reduced motion

Under `prefers-reduced-motion: reduce` nothing animates:

- `intro.html` shows its final frame (the mark in the nav, the site complete). "Play again" shows the final frame too, and a note says why.
- `loader.html` shows the static logo: filled Champagne hexagon with an Ink H, no light.

Both pages listen for changes. Turning reduced motion on while a page is open stops the motion at once and shows the final frame or static logo. Turning it off restarts the loader; the intro waits for "Play again".

The markup itself is the final frame and the static logo, so the pages are also complete without JavaScript.

## Checks

```
node design/brand/check-brand.mjs                           # exits 0
node design/brand/check-brand.mjs design/brand/fixtures/failing   # exits 1
```

`check-brand.mjs` has no dependencies. It checks that:

- the seven files above are present;
- every `.svg` is well-formed XML with a `viewBox` and a `<title>`, and uses only the six brand hex values (`fill`, `stroke` and `stop-color` must be a brand hex, `none`, `currentColor` or a local `url(#id)`);
- no `.svg` or `.html` references anything outside itself;
- every `.html` exposes a `DURATIONS` table with no step under 300 ms, has no CSS transition or animation under 300 ms, and follows `prefers-reduced-motion` including live changes.

It cannot see easing, flashes or overlaps; those are described above and checked by reading.

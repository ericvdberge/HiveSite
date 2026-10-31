# Design

Visual design for Hivesite sites, written so renderers never need a hard-coded value.

- `tokens.json`: three themes, each with the same keys.
- `blocks/<type>.md`: one layout note per block type in API-003.
- The block notes will become the default Vue components in `@hivesite/blocks` (#36).
- `check-contrast.mjs`: `node design/check-contrast.mjs design/tokens.json` checks that the themes share their keys and prints every contrast ratio.
- `brand/`: logo, lockups and motion samples. See [brand/README.md](brand/README.md).

## Themes

| Key | Name | Scheme | Character |
|---|---|---|---|
| `atelier` | Atelier | dark | Ivory on Ink, Champagne accent, Cormorant Garamond display. The default. |
| `ivory` | Ivory | light | Ink on Ivory, deep Bronze accent, Cormorant Garamond display, soft corners. |
| `studio` | Studio | light | Ink on paper, square corners, Hanken Grotesk display, Ink buttons. |

`default_theme` in `tokens.json` names the theme a new site gets.

## Reading tokens

Each theme is a tree of groups (`color`, `font`, `space`, …) with string values that are valid CSS as written.

A token's CSS custom property is `--hs-` plus its path, joined with `-`, with `_` turned into `-`:

| Path | Custom property |
|---|---|
| `color.text_muted` | `--hs-color-text-muted` |
| `font_size.display_xl` | `--hs-font-size-display-xl` |
| `space.5` | `--hs-space-5` |
| `motion.duration_base` | `--hs-motion-duration-base` |

Renderers emit one `:root` block per site with the chosen theme's properties, and use `var(--hs-…)` everywhere else. `breakpoint.*` cannot be used inside `@media`, so renderers write those values into their media queries from the token at build time, never as literals in code.

`name`, `description` and `color_scheme` are metadata. `color_scheme` goes into `<meta name="color-scheme">` and the CSS `color-scheme` property.

## Color roles

| Token | Use | Contrast rule |
|---|---|---|
| `background` | Page background | |
| `surface` | Cards, form panel | |
| `surface_sunk` | Inputs | |
| `text` | Body text, headings | 4.5:1 on `background`, `surface`, `surface_sunk` |
| `text_muted` | Subtitles, captions, labels, meta | 4.5:1 on the same three and on `placeholder_media` |
| `accent` | Button fill, active marks | `on_accent` on it is 4.5:1 |
| `accent_text` | Links, eyebrows, accent words | 4.5:1 on `background`, `surface` |
| `on_accent` | Text on `accent` | 4.5:1 on `accent` |
| `rule` | Decorative lines only, never text | none (decorative) |
| `border` | Decorative dividers and card edges | none (decorative) |
| `border_strong` | Input and control edges | 3:1 on `background`, `surface`, `surface_sunk` (WCAG 1.4.11) |
| `focus` | Focus ring | 3:1 on `background`, `surface`, `surface_sunk` |
| `error` | Error text and invalid input edge | 4.5:1 on `background`, `surface`, `surface_sunk` |
| `image_scrim` | Layer between an image and text on it | |
| `on_image` | Text on `image_scrim` | 4.5:1 on the scrim over any image, checked over pure white |
| `placeholder_media` | Box shown while an image or embed loads | |

Every text pair passes WCAG 2.2 AA in all three themes. The ratios are in the PR that added this file; recheck them in any PR that changes a color.

## Shared block rules

These hold for every block, so the block notes only list what differs.

**Section.** Each block renders as one `<section>` with `padding-block: layout.section_y` and `padding-inline: layout.gutter`. Blocks follow each other with no extra margin; the padding is the rhythm.

**Widths.** Three column widths, centered: `layout.content_width` (reading), `layout.wide_width` (grids, wide media) and full bleed (edge to edge, no gutter). Text never runs wider than `layout.measure`.

**Block heading.** The optional `heading` attribute (gallery, card list, contact form) is an `<h2>` in `font.display`, `font_size.display_l`, `font_weight.display`, `line_height.display`, `letter_spacing.display`, color `text`, with `space.6` below it. An empty heading renders nothing, not an empty element. Without a heading the block gets `aria-label` from its block name (for example "Gallery").

**Heading levels.** The hero title is the page's only `<h1>`. Block headings are `<h2>`. Rich text has `h2` and `h3` only (API-003), so the outline never skips a level.

**Labels.** Eyebrows and small meta use `font.label`, `font_size.label`, `font_weight.label`, `letter_spacing.label`, uppercase, color `accent_text` or `text_muted`.

**Links.** Color `accent_text`, underlined with `text-underline-offset: 0.2em` and `text-decoration-thickness: border_width.hairline`. On hover the underline thickens to `border_width.focus`. Color is never the only signal.

**Buttons.** One style, used by the hero call to action, card actions and the form submit: `accent` fill, `on_accent` text, `font.text` at `font_size.body_s` with `font_weight.text_strong`, `radius.control`, `control.min_height`, `control.padding_x`/`padding_y`. Hover: the label gains an underline (`text-underline-offset: 0.2em`); the fill does not change, so every theme keeps its tested pair. An `<a>` when it navigates (hero, cards), a `<button>` only for the form submit.

**Focus.** Every interactive element shows `outline: border_width.focus solid color.focus` with `outline-offset: border_width.focus_offset` on `:focus-visible`. Never removed.

**Plain strings.** Every plain string attribute is HTML-escaped (API-003). Long words wrap with `overflow-wrap: anywhere`; text is never cut off with an ellipsis except where a note says so.

**Images.** External `https://` URLs (API-003). Always `alt` from the attribute; an empty `alt` means decorative and renders `alt=""`. Every image has `width`/`height` or an `aspect-ratio` so the page does not shift, `loading="lazy"` and `decoding="async"` except the hero image, which loads eagerly. While loading, the box shows `placeholder_media`. A failed image keeps its box and shows `placeholder_media` with the alt text in `text_muted`.

## Motion

Follows the brand: one shape at a time, no flashes, slow in and slow out, nothing faster than 300 ms, every motion ends where the next one starts.

- **Reveal.** A block's content fades in from `opacity: 0` and `translateY(motion.rise_distance)` over `motion.duration_slow` with `motion.easing_enter`, once, when it first enters the viewport. Items in a grid (gallery, cards) follow `motion.stagger` apart, capped at 6 items so no grid takes longer than one more `duration_slow`.
- **State changes.** Hover, focus and press transitions use `motion.duration_base` with `motion.easing_standard`. Colors and borders only; nothing grows or bounces.
- **No motion before content.** Content is visible without JavaScript. The reveal is an enhancement added by a class the script sets, so a page without scripts shows everything at once.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`: content is simply there, and state changes are instant. Nothing autoplays.

`stagger` (70 ms) is a delay between starts, not a duration, so it does not break the 300 ms rule.

## Changing tokens

- Add or rename a key in all three themes in the same PR. The keys must match exactly.
- Run `check-contrast.mjs` and list the ratios in the PR.
- A renamed key is a breaking change for Rendering; say so in the PR and link the Rendering story.

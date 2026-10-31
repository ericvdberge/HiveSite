---
id: API-010
title: Themes
domain: rendering
status: in review
owner: api-architect
stories: [16]
depends_on: [API-001]
version: 1
---

## Purpose
An owner can list the three themes with their design tokens, and anyone can load a theme's stylesheet and fonts. A site's chosen theme and style choices are its brand styling. Brand styling comes from the `brand_styling` entity (API-005, in review on `spec/API-005-entities`); this spec defines what its values mean in tokens.

Auth, ids, errors, validation, lists and timestamps follow the shared conventions in API-001.

## Endpoints

### GET /themes
Auth: owner

Operation: `ListThemes`

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /themes
```

Response 200

All three themes, in the order of the table in Themes below. The first item is shown in full, with the values of `design/tokens.json`. The other two have the same shape and the same token names; only the values differ.
```json
{
  "items": [
    {
      "key": "atelier",
      "name": "Atelier",
      "description": "Dark and warm. Ivory on ink, champagne accents, a serif display.",
      "color_scheme": "dark",
      "version": 1,
      "tokens": {
        "color": {
          "background": "#100E0B",
          "surface": "#17140F",
          "surface_sunk": "#1E1A14",
          "text": "#F5F1E8",
          "text_muted": "#A69D8C",
          "accent": "#CDAE74",
          "accent_text": "#CDAE74",
          "on_accent": "#100E0B",
          "rule": "#94733A",
          "border": "#2C2820",
          "border_strong": "#7A7262",
          "focus": "#CDAE74",
          "error": "#E8A08C",
          "image_scrim": "rgba(16, 14, 11, 0.72)",
          "on_image": "#F5F1E8",
          "placeholder_media": "#221F19"
        },
        "font": {
          "display": "\"Cormorant Garamond\", \"Iowan Old Style\", Georgia, serif",
          "text": "\"Hanken Grotesk\", ui-sans-serif, system-ui, sans-serif",
          "label": "\"IBM Plex Mono\", ui-monospace, Menlo, monospace"
        },
        "font_weight": {
          "display": "500",
          "display_strong": "600",
          "text": "400",
          "text_strong": "600",
          "label": "500"
        },
        "font_size": {
          "display_xl": "clamp(2.75rem, 1.75rem + 4.4vw, 5.25rem)",
          "display_l": "clamp(2rem, 1.6rem + 1.8vw, 2.875rem)",
          "display_m": "1.5rem",
          "body_l": "1.1875rem",
          "body": "1.0625rem",
          "body_s": "0.875rem",
          "label": "0.75rem"
        },
        "line_height": {
          "display": "1.08",
          "heading": "1.2",
          "body": "1.65",
          "label": "1.4"
        },
        "letter_spacing": {
          "display": "-0.01em",
          "body": "0",
          "label": "0.18em"
        },
        "space": {
          "0": "0",
          "1": "0.25rem",
          "2": "0.5rem",
          "3": "0.75rem",
          "4": "1rem",
          "5": "1.5rem",
          "6": "2rem",
          "7": "3rem",
          "8": "4rem",
          "9": "6rem"
        },
        "layout": {
          "content_width": "42rem",
          "wide_width": "72rem",
          "measure": "68ch",
          "gutter": "clamp(1rem, 0.5rem + 2.5vw, 2.5rem)",
          "section_y": "clamp(4rem, 2.5rem + 5vw, 7rem)",
          "grid_gap": "1.5rem",
          "stack_gap": "1rem"
        },
        "radius": {
          "control": "2px",
          "card": "4px",
          "media": "2px"
        },
        "border_width": {
          "hairline": "1px",
          "control": "1px",
          "focus": "2px",
          "focus_offset": "3px"
        },
        "control": {
          "min_height": "2.75rem",
          "padding_x": "1.25rem",
          "padding_y": "0.75rem"
        },
        "media": {
          "hero_min_height": "min(80vh, 44rem)",
          "card_ratio": "3 / 2",
          "list_thumb_width": "9rem",
          "gallery_ratio": "4 / 3",
          "image_max_height": "80vh"
        },
        "motion": {
          "duration_base": "300ms",
          "duration_slow": "500ms",
          "duration_slower": "800ms",
          "stagger": "70ms",
          "easing_standard": "cubic-bezier(0.65, 0, 0.35, 1)",
          "easing_enter": "cubic-bezier(0.22, 0.8, 0.24, 1)",
          "rise_distance": "8px",
          "reduced_duration": "0ms",
          "reduced_rise_distance": "0px"
        },
        "breakpoint": {
          "sm": "37.5rem",
          "md": "60rem",
          "lg": "80rem"
        }
      }
    },
    { "key": "ivory", "name": "Ivory", "description": "Light and warm. Ink on ivory, bronze accents, a serif display.", "color_scheme": "light", "version": 1, "tokens": { "…": "same names, values from design/tokens.json" } },
    { "key": "studio", "name": "Studio", "description": "Light and spare. Ink on paper, square corners, a grotesk display.", "color_scheme": "light", "version": 1, "tokens": { "…": "same names, values from design/tokens.json" } }
  ],
  "next_cursor": null
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit`.
- 400 `invalid_cursor`: `cursor` is not a cursor this endpoint returned. `field` is `cursor`. With three themes and the default `limit`, `next_cursor` is always `null`.
- 401 `unauthenticated`

### GET /themes/{key}/assets/{file}
Auth: none (public)

Operation: `GetThemeAsset`

The theme's stylesheet and font files, for the draft preview. Published sites carry their own copy in each release (API-020, API-021).

Request
```
GET /themes/atelier/assets/theme.5f1c9a2e.css
```

Response 200

Headers: `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`
```css
:root{--hs-color-background:#100E0B;--hs-color-surface:#17140F;--hs-color-surface-sunk:#1E1A14;…}
:root[data-display-font="grotesk"]{--hs-font-display:"Hanken Grotesk", ui-sans-serif, system-ui, sans-serif}
:root[data-corners="square"]{--hs-radius-control:0;--hs-radius-card:0;--hs-radius-media:0}
…
```

Errors
- 404 `asset_not_found`: no theme with this key, or the theme has no asset with this name. The body is the JSON error shape.

## Themes

| `key` | `name` | `color_scheme` | Character |
|---|---|---|---|
| `atelier` | Atelier | `dark` | Ivory on Ink, Champagne accent, Cormorant Garamond display. The default. |
| `ivory` | Ivory | `light` | Ink on Ivory, deep Bronze accent, Cormorant Garamond display, soft corners. |
| `studio` | Studio | `light` | Ink on paper, square corners, Hanken Grotesk display, Ink buttons. |

Token values for all three are the ones in `design/tokens.json` (#9). The file is the source; when it changes, the theme's `version` goes up and this example follows in the next version of this spec.

## Brand styling
Brand styling comes from the `brand_styling` entity (API-005). It picks a theme and may change two things on top of it. The field names below are the ones this spec needs; API-005 defines the entity type and owns them (see Open questions). Each choice names tokens that already exist in `design/tokens.json`; none adds a color or a size.

| Field | Value | Tokens used |
|---|---|---|
| `theme` | `atelier`, `ivory`, `studio` | All tokens of that theme. |
| `display_font` | `from_theme` | The theme's `font.display`. |
| | `serif` | `font.display` of `atelier` (Cormorant Garamond). |
| | `grotesk` | `font.display` of `studio` (Hanken Grotesk). |
| `corners` | `from_theme` | The theme's `radius.*`. |
| | `square` | `radius.*` of `studio`. |
| | `subtle` | `radius.*` of `atelier`. |
| | `round` | `radius.*` of `ivory`. |

- Only the tokens named in the table change. All other tokens, including font sizes, letter spacing and every color, stay the theme's.
- No choice touches a color, so every contrast rule in Tokens holds for every combination.
- The registry's themes match the allowed values of the `theme` field of the `brand_styling` entity type (API-005) one to one. A test checks it.
- In HTML, a choice other than `from_theme` becomes an attribute on `<html>`: `data-display-font="serif"`, `data-corners="round"` (API-011). `from_theme` adds no attribute.

## Rules

### The registry
- The set of themes is fixed in code: exactly the three above. There is no endpoint to add, change or remove a theme.
- `key` is the stable name a site refers to. It is `snake_case`, pattern `^[a-z][a-z0-9_]{1,29}$`, and never changes.
- `version` is an integer, 1 for every theme in this spec. A change to a theme's tokens or stylesheet raises its `version`. Published releases keep the theme as it was when they were published.
- The response is the same for every owner and changes only when the code is deployed.
- Rendering stores nothing. It has no database and no site state; brand styling comes from the `brand_styling` entity (API-005).

### Tokens
- `tokens` is an object of groups. Each group is an object of token name → value. Every value is a string that is valid CSS as written: colors as uppercase `#RRGGBB` or `rgba()`, font stacks, lengths, `clamp()` and `min()` expressions, unitless numbers, ratios such as `3 / 2`, durations in `ms` and easing functions.
- Every theme has exactly the groups and names in the example above: 16 colors, 3 fonts, 5 font weights, 7 font sizes, 4 line heights, 3 letter spacings, 10 spaces (`0` to `9`), 7 layout, 3 radii, 4 border widths, 3 control, 5 media, 9 motion and 3 breakpoint tokens. Renderers (API-011) use only these names; adding or renaming one needs a new version of this spec and of `design/tokens.json`.
- Each token is published to CSS as a custom property: `--hs-` plus its path joined with `-`, with `_` turned into `-`. `color.text_muted` is `--hs-color-text-muted`, `space.5` is `--hs-space-5`, `motion.duration_base` is `--hs-motion-duration-base`.
- `breakpoint.*` cannot be used inside `@media`, so the stylesheet build writes their values into media queries from the tokens. They are never literals in code.
- Contrast follows the color roles in `design/README.md`, all WCAG 2.2 AA: `text`, `text_muted` and `error` at least 4.5:1 on `background`, `surface` and `surface_sunk`; `accent_text` at least 4.5:1 on `background` and `surface`; `on_accent` on `accent` at least 4.5:1; `border_strong` and `focus` at least 3:1 on `background`, `surface` and `surface_sunk`; `on_image` at least 4.5:1 on `image_scrim` over white. `rule` and `border` are decorative and have no rule. A test checks every theme.
- Every `motion.duration_*` is at least 300 ms (brand rule: nothing faster than 300 ms). `motion.stagger` is a delay between starts, not a duration. `motion.reduced_duration` and `motion.reduced_rise_distance` apply only under `prefers-reduced-motion: reduce`.
- `color_scheme` is `dark` or `light`. It becomes the page's `color-scheme`.

### Assets
- Each theme has one stylesheet and at most 6 font files (`woff2`). Names are `{base}.{hash}.{ext}`, where `hash` is the first 8 hex digits of the SHA-256 of the file. A changed file gets a new name, so a name always means the same bytes and can be cached forever.
- Names match `^[a-z0-9-]+\.[0-9a-f]{8}\.(css|woff2)$`. Anything else, including a path with `/`, `..` or a query that changes the name, returns 404 `asset_not_found`.
- The stylesheet holds, in this order: the theme's tokens as custom properties on `:root`; one rule per brand styling choice other than `from_theme` (`:root[data-display-font="…"]`, `:root[data-corners="…"]`) that sets only the tokens in the Brand styling table; `@font-face` rules; the block styles from `design/blocks/`. It is at most 64 KB. It contains no `url()` to another host.
- Every theme's font files cover Cormorant Garamond, Hanken Grotesk and IBM Plex Mono in the weights its `font_weight` tokens use, so any `display_font` works in any theme. Browsers download only the fonts a page uses.
- Fonts are served from Hivesite, never from a third party, so published sites make no requests to font services.
- Content types: `.css` is `text/css; charset=utf-8`, `.woff2` is `font/woff2`.

### Contracts
- `Hivesite.Rendering.Contracts` offers the theme registry (keys, names, `color_scheme`, `version`, tokens and asset files), so Publishing (API-020) can render and store a release without calling HTTP.
- This spec raises no events. A change to brand styling is a change to the `brand_styling` entity and raises that entity's event (API-005).

### Operation names
- Each endpoint has an operation name (`ListThemes`, `GetThemeAsset`). It becomes the `operationId` and the C# method name, and is the name a tool call uses. It never changes; renaming one is a breaking change.

## Agent use
An AI agent acting for an owner, through tool calls or an MCP server, can style a site with this spec and API-005 alone. This section adds no behaviour; it says how the endpoints are used.
1. `ListThemes` gives every valid `theme` key with its `name`, `description`, `color_scheme` and tokens. An agent picks from this list and never guesses a key.
2. `GET /sites/{id}/entity-types/brand_styling` (API-005) gives the JSON Schema of brand styling: the `enum` of every choice in Brand styling above and their defaults.
3. `PATCH /sites/{id}/entities/brand_styling` (API-005) applies the choice. It sets values, so sending the same body again gives the same result and is safe to retry.

- An invalid value fails with a 400 whose `code` and `field` name the value to change (STYLE.md). The agent fixes that field and sends again.
- This spec stores nothing and changes nothing. `ListThemes` is read-only and safe to call any number of times.
- To see the result before publishing, an agent needs a preview. The preview is held with API-011 (see Open questions).

## Decisions
- **Themes are a fixed registry with a `key`, like block types (API-003).** They are not stored resources, so they have no UUID.
- **A site's theme is part of its brand styling, and brand styling comes from the `brand_styling` entity (API-005).** The owner chose this: brand styling is a built-in entity with default values, so it uses the same architecture as the rest of the content. Rendering keeps no table and stays pure; it reads brand styling through `Hivesite.Content.Contracts`. The plan's `PUT /sites/{id}/theme` is dropped; the owner sets the theme through the entity endpoints of API-005.
- **`GET /themes/{key}/assets/{file}` is added** for the preview's stylesheet and fonts. It is public: theme files hold no owner data.
- **Theme keys and token names are those of `design/tokens.json` (#9):** `atelier`, `ivory` and `studio`, and the file's groups and names. The theme metadata field is `color_scheme`, as in the file.
- **Brand styling choices are attribute selectors in the theme stylesheet,** not inline styles. The page's CSP allows no inline style (API-011), and HTML carries no values.
- **The draft uses new brand styling at once; the live site at the next publish.** Rollback (API-020) brings back, on the live site, the styling a release was published with; it does not change the `brand_styling` entity.

## Open questions
- Which fields does the `brand_styling` entity type have (API-005)? This spec assumes `theme`, `display_font` and `corners` with the values in the Brand styling table, each with a default (`atelier`, `from_theme`, `from_theme`). If API-005 names or shapes them differently, the table follows API-005.
- Does the `brand_styling` entity get color fields (the owner's color picker field type)? Today no choice touches a color, so the contrast rules in Tokens hold for every combination. The API-005 draft adds `accent_color`, which fills `color.accent_text` and is checked for contrast on save. If that stays, the Brand styling table needs an `accent_color` row, "No choice touches a color" no longer holds, and this spec must say how a free color value reaches the page: an attribute selector cannot carry it, and API-011 allows no inline style.
- Preview for agents and owners. An agent (and an owner) can only check a styling change before publishing through a preview. Preview is in API-011, which is held for ADR 3, and under ADR 3 it becomes an asynchronous build. Until a preview spec is approved, the only check is reading the `brand_styling` entity back.
- ADR 3 (sandboxed Vue/Nuxt templates) may change how the stylesheet reaches the page. The `data-display-font` and `data-corners` attributes on `<html>` and the "no inline style" reason refer to the C# renderer in API-011, which is held. Keep the attribute selectors, or let templates read tokens another way?

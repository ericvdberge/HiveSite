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
An owner can list the three themes with their design tokens, read the theme of a site and choose another one.

Auth, ids, errors, validation, lists and timestamps follow the shared conventions in API-001.

## Endpoints

### GET /themes
Auth: owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /themes
```

Response 200

All three themes, in the order of the table in Themes below. The first item is shown in full. The other two have the same shape and the same token names; only the values differ.
```json
{
  "items": [
    {
      "key": "atelier",
      "name": "Atelier",
      "description": "Dark and warm. Ivory type on ink, with champagne accents.",
      "scheme": "dark",
      "version": 1,
      "tokens": {
        "color": {
          "background": "#100E0B",
          "surface": "#17140F",
          "text": "#F5F1E8",
          "text_muted": "#A69D8C",
          "accent": "#CDAE74",
          "accent_strong": "#94733A",
          "on_accent": "#100E0B",
          "border": "#2A251D",
          "focus": "#CDAE74"
        },
        "font": {
          "display": "\"Cormorant Garamond\", Georgia, serif",
          "text": "\"Hanken Grotesk\", system-ui, sans-serif",
          "mono": "\"IBM Plex Mono\", ui-monospace, monospace"
        },
        "font_size": {
          "sm": "0.875rem",
          "md": "1rem",
          "lg": "1.25rem",
          "xl": "1.75rem",
          "xxl": "2.5rem",
          "display": "3.5rem"
        },
        "line_height": {
          "tight": "1.15",
          "normal": "1.5",
          "relaxed": "1.7"
        },
        "space": {
          "xs": "0.25rem",
          "sm": "0.5rem",
          "md": "1rem",
          "lg": "2rem",
          "xl": "4rem",
          "xxl": "8rem"
        },
        "radius": {
          "sm": "2px",
          "md": "6px"
        },
        "width": {
          "content": "42rem",
          "wide": "72rem"
        },
        "motion": {
          "duration": "400ms",
          "duration_slow": "700ms",
          "easing": "cubic-bezier(0.45, 0, 0.55, 1)"
        }
      }
    },
    { "key": "linen", "name": "Linen", "description": "…", "scheme": "light", "version": 1, "tokens": { "…": "same names, values from design/tokens.json" } },
    { "key": "studio", "name": "Studio", "description": "…", "scheme": "light", "version": 1, "tokens": { "…": "same names, values from design/tokens.json" } }
  ],
  "next_cursor": null
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`
- 401 `unauthenticated`

### GET /sites/{id}/theme
Auth: site owner

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/theme
```

Response 200
```json
{
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "theme": "atelier",
  "updated_at": null
}
```

`updated_at` is `null` while the site uses the default theme and has never chosen one.

Errors
- 401 `unauthenticated`
- 404 `site_not_found`: as in API-001.

### PUT /sites/{id}/theme
Auth: site owner

Sets the site's theme. The draft preview (API-011) uses it at once. The live site changes only with the next publish (API-020), because releases never change.

Request
```json
{
  "theme": "linen"
}
```

Response 200
```json
{
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "theme": "linen",
  "updated_at": "2026-10-28T13:05:44Z"
}
```

Errors
- 400 `invalid_request`: body is not JSON, `theme` is missing or not a string, or an unknown field is present.
- 400 `unknown_theme`: `theme` is not one of the keys in Themes. `field` is `/theme`.
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /themes/{key}/assets/{file}
Auth: none (public)

The theme's stylesheet and font files, for the draft preview. Published sites carry their own copy in each release (API-020, API-021).

Request
```
GET /themes/atelier/assets/theme.5f1c9a2e.css
```

Response 200

Headers: `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`
```css
:root{--hs-color-background:#100E0B;--hs-color-surface:#17140F;--hs-color-text:#F5F1E8;…}
```

Errors
- 404 `asset_not_found`: no theme with this key, or the theme has no asset with this name. The body is the JSON error shape.

## Themes

| `key` | `name` | `scheme` | Character |
|---|---|---|---|
| `atelier` | Atelier | `dark` | The Hivesite brand: Ink and Panel backgrounds, Ivory text, Champagne and Bronze accents. |
| `linen` | Linen | `light` | The brand inverted: Ivory background, Ink text, Bronze accents. |
| `studio` | Studio | `light` | Plain and quiet: white and stone neutrals, Hanken Grotesk for headings too, one accent. |

Token values for all three come from `design/tokens.json` (#9). The `atelier` values above are the brand colors from `CLAUDE.md`; where `design/tokens.json` differs, the file wins and this example is corrected in the next version.

## Rules

### The registry
- The set of themes is fixed in code: exactly the three above. There is no endpoint to add, change or remove a theme.
- `key` is the stable name a site refers to. It is `snake_case`, pattern `^[a-z][a-z0-9_]{1,29}$`, and never changes.
- `version` is an integer, 1 for every theme in this spec. A change to a theme's tokens or stylesheet raises its `version`. Published releases keep the theme as it was when they were published.
- The response is the same for every owner and changes only when the code is deployed.

### Tokens
- `tokens` is an object of groups. Each group is an object of token name → value. Every value is a string that is a valid CSS value as written: hex colors `#RRGGBB` in uppercase, font stacks, lengths in `rem` or `px`, unitless line heights, durations in `ms`, easing functions.
- Every theme has exactly the groups and names in the example above: 9 colors, 3 fonts, 6 font sizes, 3 line heights, 6 spaces, 2 radii, 2 widths, 3 motion tokens. Renderers (API-011) use only these names; adding a name needs a new version of this spec.
- Each token is published to CSS as a custom property `--hs-{group}-{name}`, with `_` turned into `-`: `color.text_muted` is `--hs-color-text-muted`.
- `color.text` on `color.background`, `color.text` on `color.surface` and `color.on_accent` on `color.accent` have a contrast ratio of at least 4.5:1 (WCAG 2.2 AA). `color.text_muted` on `color.background` and `color.focus` on `color.background` have at least 3:1. A test checks this for every theme.
- Every `motion` duration is at least 300 ms (brand rule: nothing faster than 300 ms).
- `scheme` is `dark` or `light`. It becomes the page's `color-scheme`.

### Assets
- Each theme has one stylesheet and at most 6 font files (`woff2`). Names are `{base}.{hash}.{ext}`, where `hash` is the first 8 hex digits of the SHA-256 of the file. A changed file gets a new name, so a name always means the same bytes and can be cached forever.
- Names match `^[a-z0-9-]+\.[0-9a-f]{8}\.(css|woff2)$`. Anything else, including a path with `/`, `..` or a query that changes the name, returns 404 `asset_not_found`.
- The stylesheet holds the token custom properties, `@font-face` rules for the theme's fonts and the block styles from `design/blocks/`. It is at most 64 KB. It contains no `url()` to another host.
- Fonts are served from Hivesite, never from a third party, so published sites make no requests to font services.
- Content types: `.css` is `text/css; charset=utf-8`, `.woff2` is `font/woff2`.

### Site theme
- Every site has exactly one theme. A site that never chose one uses `atelier`, and `GET` returns `"updated_at": null`.
- `theme` is the only field of the resource. `updated_at` follows API-001 timestamps; it changes only when the theme changes.
- `PUT` with the theme the site already has changes nothing: 200, the same `updated_at`, no event.
- `PUT` is idempotent and takes no `Idempotency-Key`.
- Site ownership is checked through `Hivesite.Content.Contracts`.

### Side effects
- A `PUT` that changes the theme raises `SiteThemeChanged { site_id, theme }` through `Hivesite.Rendering.Contracts`.
- `Hivesite.Rendering.Contracts` also offers `GetSiteTheme(site_id)` and the theme registry, so Publishing (API-020) can render a release without calling HTTP.

## Decisions
- **Themes are a fixed registry with a `key`, like block types (API-003).** They are not stored resources, so they have no UUID.
- **`GET /sites/{id}/theme` is added** to the plan's endpoint list, so an owner can read back the theme they chose. The site resource (API-001) keeps no theme field.
- **`GET /themes/{key}/assets/{file}` is added** for the preview's stylesheet and fonts. It is public: theme files hold no owner data.
- **Theme names are proposals:** `atelier`, `linen` and `studio`. If the designer names them differently in #9, this spec follows before approval.
- **The draft uses the new theme at once; the live site at the next publish.** Rollback (API-020) brings back the theme a release was published with.

## Open questions
- Where is a site's chosen theme stored? The plan says Rendering has no database. This spec proposes that the Rendering module keeps one small table (`rendering.site_themes`: `site_id`, `theme`, `updated_at`) for the endpoints, while the renderers themselves stay pure (API-011). The alternative is a `theme` field stored by Content and set through `Hivesite.Content.Contracts`, which API-001 would then need to mention.
- Do the token groups and names above match `design/tokens.json` from #9? The designer is writing it in parallel. Before approval, either the file adopts these names or this spec adopts the file's.

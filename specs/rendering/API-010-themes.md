---
id: API-010
title: Themes
domain: rendering
status: in review
owner: api-architect
stories: [16]
depends_on: [API-001]
version: 2
---

## Purpose
An owner can list Hivesite's three themes and pick one for a site. Anyone can load a theme's stylesheet and fonts. The theme is a site setting, `settings.theme` (API-001 v4), as ADR 4 decides for the MVP.

Auth, ids, errors, validation, lists and timestamps follow the shared conventions in API-001.

Version 2 follows ADR 4. It replaces version 1's `brand_styling` entity (API-005) with one site setting, drops the full token set from the response, and has the default Vue template (API-011) produce the theme assets.

## Endpoints

### GET /themes
Auth: owner

Operation: `ListThemes`

Query: `limit` (1 to 100, default 20), `cursor` (from `next_cursor` of the previous page).

Themes have no id. Their key is `key`, so `next_cursor` is the `key` of the last item on the page, or `null` on the last page, as API-003 does for block types.

Request
```
GET /themes
```

Response 200

All three themes, in the order of the table in Themes below. Values are from `design/tokens.json`.
```json
{
  "items": [
    {
      "key": "atelier",
      "name": "Atelier",
      "description": "Dark and warm. Ivory on ink, champagne accents, a serif display.",
      "color_scheme": "dark",
      "version": 1,
      "sample": {
        "background": "#100E0B",
        "surface": "#17140F",
        "text": "#F5F1E8",
        "accent": "#CDAE74",
        "display_font": "\"Cormorant Garamond\", \"Iowan Old Style\", Georgia, serif"
      }
    },
    {
      "key": "ivory",
      "name": "Ivory",
      "description": "Light and warm. Ink on ivory, bronze accents, a serif display.",
      "color_scheme": "light",
      "version": 1,
      "sample": {
        "background": "#F5F1E8",
        "surface": "#FBF8F2",
        "text": "#1B1813",
        "accent": "#7A5C2A",
        "display_font": "\"Cormorant Garamond\", \"Iowan Old Style\", Georgia, serif"
      }
    },
    {
      "key": "studio",
      "name": "Studio",
      "description": "Light and spare. Ink on paper, square corners, a grotesk display.",
      "color_scheme": "light",
      "version": 1,
      "sample": {
        "background": "#FAF8F4",
        "surface": "#FFFFFF",
        "text": "#100E0B",
        "accent": "#100E0B",
        "display_font": "\"Hanken Grotesk\", ui-sans-serif, system-ui, sans-serif"
      }
    }
  ],
  "next_cursor": null
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit`.
- 400 `invalid_cursor`: `cursor` is not the `key` of one of the three themes. `field` is `cursor`.
- 401 `unauthenticated`

### GET /themes/{key}/assets/{file}
Auth: none (public)

Operation: `GetThemeAsset`

The theme's stylesheet and font files, for the draft preview (API-011). Published sites carry their own copy in each release (API-011 Release files).

Request
```
GET /themes/atelier/assets/theme.5f1c9a2e.css
```

Response 200

Headers: `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`
```css
:root{--hs-color-background:#100E0B;--hs-color-surface:#17140F;--hs-color-surface-sunk:#1E1A14;…}
@font-face{font-family:"Cormorant Garamond";font-weight:500;font-display:swap;src:url(cormorant-garamond-500.8c1d0b7e.woff2) format("woff2")}
…
.hs-hero{padding-block:var(--hs-layout-section-y);…}
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

`design/tokens.json` is the source of every value: `name`, `description`, `color_scheme` and all tokens. When the file changes, the response follows at the next deploy.

## How a site stores its theme
- The theme is the site setting `settings.theme` (API-001 v4): one of `atelier`, `ivory`, `studio`. A new site gets `atelier`, the `default_theme` of `design/tokens.json`.
- The owner changes it with `PATCH /sites/{id}`:
  ```json
  { "settings": { "theme": "ivory" } }
  ```
  `settings` is merged one level deep (API-001), so `language` and `description` keep their values. Any other value returns 400 `invalid_request` with `field` `/settings/theme`.
- The draft preview (API-011) uses the new theme at once. The live site gets it at the next publish (API-020).
- Content validates the value against its own copy of the three keys. Content cannot read Rendering's registry (ADR 1). A Content test and a Rendering test each check their keys against the theme keys in `design/tokens.json`.

## Rules

### The registry
- The set of themes is fixed: exactly the three above. There is no endpoint to add, change or remove a theme.
- `key` is the stable name a site refers to. It matches `^[a-z][a-z0-9_]{1,29}$` and never changes.
- `version` is the top-level `version` of `design/tokens.json`, 1 today, the same for all three themes. Publishing records it on each release (API-020).
- `sample` holds five values for a theme picker, each copied from the theme's tokens: `background` is `color.background`, `surface` is `color.surface`, `text` is `color.text`, `accent` is `color.accent`, `display_font` is `font.display`. The full token set is not served over HTTP: only the default template (API-011) reads it, at its own build time.
- The response is the same for every owner and changes only when Hivesite is deployed.
- Rendering stores nothing and has no database. It reads the registry from the manifest the default template build writes (API-011 Tooling).

### Tokens
- Token groups and names are those of `design/tokens.json`. Adding or renaming one is a change to that file, made in all three themes in the same PR (`design/README.md`).
- Each token reaches CSS as a custom property: `--hs-` plus its path joined with `-`, with `_` turned into `-`. `color.text_muted` is `--hs-color-text-muted`, `space.5` is `--hs-space-5`.
- `breakpoint.*` cannot be used inside `@media`, so the stylesheet build writes their values into the media queries from the tokens. They are never literals in code.
- Contrast follows the color roles in `design/README.md`, all WCAG 2.2 AA. A test runs `design/check-contrast.mjs` on every theme.
- Every `motion.duration_*` is at least 300 ms. `motion.reduced_*` apply under `prefers-reduced-motion: reduce`.
- `color_scheme` becomes the page's `<meta name="color-scheme">` (API-011).

### Assets
- Each theme has one stylesheet and at most 6 font files (`woff2`). The default template build writes them (API-011 Tooling).
- Names are `{base}.{hash}.{ext}`, where `hash` is the first 8 hex digits of the SHA-256 of the file. A changed file gets a new name, so a name always means the same bytes and can be cached forever.
- Names match `^[a-z0-9-]+\.[0-9a-f]{8}\.(css|woff2)$`. Anything else, including a path with `/` or `..`, returns 404 `asset_not_found`.
- The stylesheet holds, in this order: the theme's tokens as custom properties on `:root`, the `@font-face` rules, and the block styles of `@hivesite/blocks` (API-011), which use only `var(--hs-…)`. It is at most 128 KB.
- `@font-face` rules point to the font files by bare file name (`url(cormorant-garamond-500.8c1d0b7e.woff2)`). The fonts sit next to the stylesheet, so the same file works under `/themes/{key}/assets/` and under a release's `assets/`. The stylesheet has no `url()` to another host.
- A theme's font files cover the families and weights its own `font.*` and `font_weight.*` tokens use. Fonts are served from Hivesite, never from a font service.
- Content types: `.css` is `text/css; charset=utf-8`, `.woff2` is `font/woff2`.

### Contracts
- `Hivesite.Rendering.Contracts` offers `ListThemes`: the same items as `GET /themes`, plus each theme's asset file names. Publishing (API-020) reads `version` from it.
- This spec raises no events. A theme change is a site change and raises `SiteChanged` (API-001).

### Operation names
- Each endpoint has an operation name (`ListThemes`, `GetThemeAsset`). It becomes the `operationId` and the C# method name, and is the name a tool call uses. Renaming one is a breaking change.

## Agent use
An AI agent acting for an owner, through tool calls or an MCP server, can style a site with this spec, API-001 and API-011. This section adds no behaviour.
1. `ListThemes` gives every valid key with its `name`, `description`, `color_scheme` and `sample`. The agent picks from this list and never guesses a key.
2. `PATCH /sites/{id}` with `{ "settings": { "theme": "{key}" } }` applies it. It sets a value, so sending it again gives the same result and is safe to retry.
3. `GET /pages/{id}/preview` (API-011) shows the result before publishing. `?theme={key}` shows another theme without saving it.

## Decisions
- **The theme is a site setting, `settings.theme`, not the `brand_styling` entity** (ADR 4). This needs API-001 v4, in this same spec PR. `PATCH /sites/{id}` already merges `settings`, so no new endpoint is needed. The plan's `PUT /sites/{id}/theme` stays dropped. API-005 stays the plan for brand styling after the MVP.
- **Invalid theme keys are `invalid_request` with `field` `/settings/theme`,** like every other bad value in API-001. There is no separate `unknown_theme` code on the site.
- **`GET /themes` returns a five-value `sample`, not the full token set.** The studio needs swatches for a picker. The full tokens are build input for the default template, not an API.
- **`version` is the `version` of `design/tokens.json`.** One number, one source.
- **`GET /themes/{key}/assets/{file}` is public.** Theme files hold no owner data.
- **Fonts sit next to the stylesheet and are referenced by bare file name,** so one stylesheet serves the preview and every release unchanged.
- **Content keeps its own copy of the three keys,** checked by a test against `design/tokens.json`, so it does not depend on Rendering.
- **Not in this version:** display font and corner choices on top of a theme (version 1's `display_font` and `corners`), an accent color or any owner color, owner-made themes, brand styling as an entity (API-005, ADR 3), and serving the full token set over HTTP.

## Open questions
- none

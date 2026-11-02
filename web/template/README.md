# @hivesite/template-default

The default template. This story (#161) builds the theme assets; the page shell, block styles and `render.mjs` come with #162 onwards.

## Commands
- `npm ci`
- `npm run build`: writes `dist/themes/{key}/` and `dist/themes.json` from `design/tokens.json`. The same tokens give the same files.
- `npm test`, `npm run lint`, `npm run typecheck`

Block and shell styles join the stylesheet through `styleSources` in `src/theme/build.ts` (empty today). Media queries use `breakpoint(sm|md|lg)` in style sources; the build writes the theme's width.

## Output
```
dist/
  themes.json
  themes/{key}/theme.{hash}.css
  themes/{key}/{family}-{weight}.{hash}.woff2
```
`hash` is the first 8 hex digits of the SHA-256 of the file. Fonts are the `latin` subset from `@fontsource/*`, only the weights the theme's `font` and `font_weight` tokens use. The stylesheet refers to them by bare file name.

## `themes.json`
API-010 does not fix the shape; this is it (version 1).
```json
{
  "version": 1,
  "default_theme": "atelier",
  "themes": [
    {
      "key": "atelier",
      "name": "Atelier",
      "description": "…",
      "color_scheme": "dark",
      "version": 1,
      "sample": { "background": "#100E0B", "surface": "#17140F", "text": "#F5F1E8", "accent": "#CDAE74", "display_font": "\"Cormorant Garamond\", …" },
      "assets": { "stylesheet": "theme.5f1c9a2e.css", "fonts": ["cormorant-garamond-500.8197bf53.woff2", "…"] }
    }
  ]
}
```
- Top-level `version` and `default_theme` come from `design/tokens.json`; each theme's `version` is the same value.
- `themes` follows the order of the tokens file. `assets.fonts` is sorted by family, then weight.

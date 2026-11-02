# @hivesite/template-default

The default template (API-011, API-010): the page shell, the theme assets and `dist/render.mjs`. Block components live in `../packages/blocks` (`@hivesite/blocks`, source only, no build of its own).

## Commands
- `npm ci`
- `npm run build`: writes `dist/themes/{key}/` and `dist/themes.json` from `design/tokens.json`, then bundles `src/render.ts` to `dist/render.mjs` (Vite SSR, Vue and `themes.json` inlined, so it runs without `node_modules`). The same input gives the same files.
- `node dist/render.mjs < request.json`: a JSON request on stdin (API-011, Running the template), `{ "files": [{ "path", "html" }] }` on stdout. On a bad request or an unknown block type: non-zero exit, nothing on stdout, a short reason on stderr.
- `npm test`, `npm run lint`, `npm run typecheck`

Shell styles (`src/styles/shell.css`) and block styles (`../packages/blocks/src/styles/*.css`, `shared.css` first) join the stylesheet through `styleSources` in `src/theme/build.ts`; a new block adds its CSS file there. Media queries use `breakpoint(sm|md|lg)` in style sources; the build writes the theme's width.

## Output
```
dist/
  render.mjs
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

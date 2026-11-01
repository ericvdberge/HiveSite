---
id: API-011
title: Block rendering and draft preview
domain: rendering
status: in review
owner: api-architect
stories: [17, 18]
depends_on: [API-001, API-002, API-003, API-004, API-010]
version: 2
---

## Purpose
Rendering builds a site's static files from one snapshot of its content with Hivesite's default Vue template, the same way every time. A site owner can see any draft page, built the same way, before it is published.

Auth, ids, errors, validation and timestamps follow the shared conventions in API-001. The theme is `settings.theme` (API-001 v4, API-010). Block types and their attributes are in API-003, the blocks document in API-004, the block layouts in `design/blocks/`.

Version 2 follows ADR 4. The C# renderer of version 1 is replaced by the default Vue template (`@hivesite/blocks` plus one template), which Rendering runs with Node, as trusted code, from the Host. Brand styling choices and list pages are gone; the theme is one site setting.

## Endpoints

### GET /pages/{id}/preview
Auth: site owner

Operation: `PreviewPage`

Query: `theme` (optional), a theme key from API-010. Builds with that theme instead of the site's `settings.theme`, without saving it, so an owner can compare themes.

Builds the page as it is now in Content (current blocks, menu and site settings) and returns its HTML. Nothing is stored.

Request
```
GET /pages/01a181d8-810e-7cfa-b14e-65065bb59fa1/preview
```

Response 200

Headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and the headers in Security below.

The site is Atelier Noor (`language` `nl`, `theme` `atelier`) with three pages in menu order: Home (`01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0`), About (`01a181d4-5e8b-75fc-bd2f-613219bf3f79`, slug `about`) and Our work (`01a181d8-810e-7cfa-b14e-65065bb59fa1`, slug `our-work`). Our work has a `hero` and a `rich_text` block. The example is wrapped for reading; the real body is as Vue's server renderer writes it (see Output).
```html
<!doctype html>
<html lang="nl" data-theme="atelier">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="generator" content="Hivesite">
<meta name="color-scheme" content="dark">
<title>Our work · Atelier Noor</title>
<meta name="description" content="Handmade ceramics from Utrecht.">
<link rel="stylesheet" href="/themes/atelier/assets/theme.5f1c9a2e.css">
</head>
<body>
<a class="hs-skip" href="#hs-main">Naar de inhoud</a>
<p class="hs-preview-label">Voorbeeld · niet gepubliceerd</p>
<header class="hs-header">
<a class="hs-header__name" href="/pages/01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0/preview">Atelier Noor</a>
<nav class="hs-menu" aria-label="Hoofdmenu">
<ul>
<li><a href="/pages/01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0/preview">Home</a></li>
<li><a href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">About</a></li>
<li><a href="/pages/01a181d8-810e-7cfa-b14e-65065bb59fa1/preview" aria-current="page">Our work</a></li>
</ul>
</nav>
</header>
<main class="hs-main" id="hs-main">
<section class="hs-hero" id="hs-b0" data-variant="image">
<img class="hs-hero__image" src="https://images.example.com/noor/vases.jpg" alt="Three celadon vases on linen" loading="eager" decoding="async">
<div class="hs-hero__body">
<h1 class="hs-hero__title">Selected work</h1>
<p class="hs-hero__subtitle">Bowls, vases and tableware.</p>
<a class="hs-button" href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">Meet the maker</a>
</div>
</section>
<section class="hs-rich-text" id="hs-b1">
<div class="hs-prose">
<p>Every piece is thrown, glazed and fired in <strong>Utrecht</strong>. Read more <a href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">about the studio</a>.</p>
</div>
</section>
</main>
<footer class="hs-footer">
<p class="hs-footer__name">Atelier Noor</p>
</footer>
</body>
</html>
```

The blocks behind this example:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "hero",
      "attrs": {
        "title": "Selected work",
        "subtitle": "Bowls, vases and tableware.",
        "image": { "url": "https://images.example.com/noor/vases.jpg", "alt": "Three celadon vases on linen" },
        "cta": { "label": "Meet the maker", "href": "/about" }
      }
    },
    {
      "type": "rich_text",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Every piece is thrown, glazed and fired in " },
            { "type": "text", "marks": [{ "type": "bold" }], "text": "Utrecht" },
            { "type": "text", "text": ". Read more " },
            { "type": "text", "marks": [{ "type": "link", "attrs": { "href": "/about", "target": null, "rel": null, "class": null } }], "text": "about the studio" },
            { "type": "text", "text": "." }
          ]
        }
      ]
    }
  ]
}
```

Errors

Errors are JSON in the shape of `specs/STYLE.md`, not HTML.
- 400 `unknown_theme`: `theme` is sent and is not one of the API-010 keys, including an empty value. `field` is `theme`.
- 401 `unauthenticated`
- 404 `page_not_found`: as in API-002.
- 500 `build_failed`: the build did not finish: Node exited with an error, wrote output that breaks the Build contract, or ran longer than 10 seconds. The owner can try again; the cause is in the Host's log. This is a Hivesite bug, never a content problem.

#### How the studio shows it
The studio opens the preview URL in a new browser tab. The page is served from the API origin, so every absolute path in it resolves there:
- the stylesheet: `/themes/{key}/assets/{file}` (API-010), and the fonts next to it;
- links to other pages of the site: `/pages/{page_id}/preview`, with `?theme={key}` added when the preview was asked with `theme`;
- images: their own `https://` URLs (API-003).

## Snapshot

The snapshot is everything a build reads: the site and its theme, the menu, the pages and their blocks. It is the minimal subset of the API-005 snapshot that the default template needs. When API-005's snapshot is built, it can replace this one; it then raises `snapshot_format` to 2.

```json
{
  "snapshot_format": 1,
  "site": {
    "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
    "name": "Atelier Noor",
    "slug": "atelier-noor",
    "settings": {
      "language": "nl",
      "description": "Handmade ceramics from Utrecht.",
      "theme": "atelier"
    }
  },
  "pages": [
    {
      "id": "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
      "title": "Home",
      "slug": "home",
      "menu_order": 0,
      "created_at": "2026-10-28T09:20:00Z",
      "blocks": { "type": "doc", "content": [] }
    },
    {
      "id": "01a181d4-5e8b-75fc-bd2f-613219bf3f79",
      "title": "About",
      "slug": "about",
      "menu_order": 1,
      "created_at": "2026-10-28T09:25:41Z",
      "blocks": { "type": "doc", "content": [] }
    }
  ]
}
```
- `site`: the fields of API-001 that a build uses, with the same names. A preview with `?theme=` puts that key in `site.settings.theme`.
- `pages`: every page of the site in `menu_order`. This order is the menu: every page is in it (API-002). `blocks` is the page's stored document (API-004), validated there and not validated again.
- Keys are in the order shown, and the JSON is compact UTF-8. The same stored content gives the same bytes.
- At most 14 MB (14,680,064 bytes): 50 pages (API-002) with at most 256 KB of blocks each (API-004).

### Where it comes from
Content offers it in-process through `Hivesite.Content.Contracts`. This adds two operations to `IContentApi`, built by Content:
- `GetSiteSnapshot(site_id)`: the snapshot of that site, or `null` when the site does not exist or belongs to another owner.
- `GetSiteSnapshotForPage(page_id)`: the snapshot of the site that holds that page, or `null` when the page does not exist or its site belongs to another owner.

Both read the site, its pages and their blocks in one transaction, so they belong to the same moment. They return records with the snapshot's fields in PascalCase; Rendering writes them as the JSON above.

## Build contract

Rendering offers two operations through `Hivesite.Rendering.Contracts`. The preview endpoint calls `RenderPage`; Publishing (API-020) calls `RenderSite`. Both are pure: a snapshot in, files out, and the same snapshot always gives byte-identical files. Neither stores anything.

### RenderPage(snapshot, page_id, preview_theme) → HTML
Returns one HTML document, built in `preview` mode, as a UTF-8 string. `preview_theme` is the `theme` query value or `null`; it only adds `?theme=` to preview links. Fails with `build_failed`.

### RenderSite(snapshot) → files
Returns every file of the static site, built in `release` mode, as a list of `{ path, content_type, bytes }` sorted by `path` in ordinal order. Fails with `no_pages` when the snapshot has no pages, `build_too_large` when the output breaks a limit below, or `build_failed`.

### Release files

| `path` | What | `content_type` |
|---|---|---|
| `/` | the home page (`menu_order` 0) | `text/html; charset=utf-8` |
| `/{page_slug}` | every other page | `text/html; charset=utf-8` |
| `/404.html` | the not-found page | `text/html; charset=utf-8` |
| `/assets/{file}` | the theme's stylesheet and fonts (API-010), copied as they are | `text/css; charset=utf-8` or `font/woff2` |

API-002 reserves the page slug `assets`, so pages and assets cannot clash.

### Running the template
Rendering runs the default template's build with Node, once per call:
1. It starts `node {template_dir}/render.mjs` as a child process of the Host, with no arguments.
2. It writes one JSON request to the process's stdin and closes it:
   ```json
   {
     "mode": "preview",
     "page_id": "01a181d8-810e-7cfa-b14e-65065bb59fa1",
     "preview_theme": null,
     "snapshot": { "snapshot_format": 1, "site": { "…": "as Snapshot" }, "pages": [] }
   }
   ```
   In `release` mode `page_id` and `preview_theme` are `null`.
3. The process writes one JSON response to stdout and exits with code 0:
   ```json
   {
     "files": [
       { "path": "/our-work", "html": "<!doctype html>…" }
     ]
   }
   ```
   In `preview` mode `files` holds exactly the one page. In `release` mode it holds `/`, every `/{page_slug}` and `/404.html`. Node writes HTML only; Rendering adds `/assets/{file}` from the theme's built assets and sets every `content_type`.
4. Anything else is `build_failed`: a non-zero exit code, output that is not this JSON, a missing or extra path, or a run over the time limit. Rendering kills the process at the limit and logs the first 4 KB of stderr.

### Limits

| | Preview | Release |
|---|---|---|
| Wall clock per build, then killed | 10 seconds | 30 seconds |
| Snapshot in | 14 MB | 14 MB |
| Output on stdout | 2 MB | 50 MB |
| One HTML file | 2 MB | 2 MB |
| Files in the result | 1 | 3,000, including assets |
| Bytes in the result | 2 MB | 50 MB (52,428,800), including assets |

A release over its file or byte limit fails with `build_too_large`; API-020 passes it through unchanged as 400 `build_too_large`. Output over a stdout or HTML file limit is `build_failed`. With the limits of API-002 to API-004 a site has at most 51 HTML files and the theme's 7 assets, so these limits only catch a bug.

## Modes

| | `release` | `preview` |
|---|---|---|
| Links to site pages | relative (see Links) | `/pages/{page_id}/preview`, plus `?theme={key}` when `preview_theme` is set |
| Stylesheet | `assets/{file}`, relative | `/themes/{key}/assets/{file}` (API-010) |
| `<meta name="robots" content="noindex">` | no | yes |
| Preview label | no | `<p class="hs-preview-label">` right after the skip link |

Release HTML never contains the site slug, except in the not-found page's `<base>`, so a release stays correct when the slug changes.

## Document

Every HTML page has the structure of the example above, in this order:
1. `<!doctype html>`, then `<html lang="{site.settings.language}" data-theme="{site.settings.theme}">`.
2. `<head>`: `charset`, `viewport`, `robots` (preview only), `generator` (`Hivesite`), `color-scheme` (the theme's `color_scheme`), `<title>`, `description` (left out when `site.settings.description` is `""`), the stylesheet link. Nothing else.
3. `<body>`: skip link to `#hs-main`, preview label (preview only), `<header class="hs-header">` with the site name linked to the home page and the menu, `<main class="hs-main" id="hs-main">` with the blocks, `<footer class="hs-footer">` with the site name.

### Title
- Home page: `{site name}`.
- Other pages: `{page title} · {site name}`.

### Menu
- `<nav class="hs-menu" aria-label="{Main menu}">` with a `<ul>` of every page in `menu_order`. Each item links to the page by its title.
- The current page's link has `aria-current="page"`.

### Headings
- Exactly one `<h1>` per page. If block 0 is a `hero`, its title is the `<h1>`. Otherwise `<main>` starts with `<h1 class="hs-page-title">{page title}</h1>`, before the first block.
- A `hero` that is not block 0 uses `<h2>` for its title.
- Block headings (`gallery`, `card_list`, `contact_form`) are `<h2>`. Card titles are `<h3>`. Rich text headings keep their level (2 or 3).

### Output
- The page is rendered on the server with Vue's `renderToString`. It holds no `<script>`, no hydration data and no event handler attributes: a built site is plain HTML and CSS.
- Whitespace and Vue's own comment markers (`<!--[-->`) are as Vue writes them. The exact bytes are fixed by the snapshot tests, not by this spec; this spec fixes elements, attributes, classes and their order.
- No `style` attributes and no `<style>` elements. Owner values that change the layout become `data-` attributes the stylesheet styles (see Blocks).
- UTF-8 without BOM.

### Escaping
- Every string from content is HTML-escaped, in text and in attribute values, as Vue does for `{{ }}` and bound attributes. Components never use `v-html` or `innerHTML` with content.
- Rich text `text` is literal (API-003): `<b>` in content is shown as the characters `<b>`.

## Blocks

Each block type is one component in `@hivesite/blocks`. Its markup is the Structure in `design/blocks/{type}.md`: the same elements, classes, `data-` attributes and order, with these rules on top:
- The block's top element gets `id="hs-b{i}"`, where `i` is its 0-based position in the page. Ids inside a block start with it: `hs-b{i}-heading` for its heading, `hs-b{i}-{name}` for a form field.
- An empty string attribute and a `null` attribute leave out the element that would show them.
- A block with a `heading` attribute has `aria-labelledby="hs-b{i}-heading"` when the heading is not empty, and `aria-label` with its block name from Strings when it is.
- Images: `<img src alt loading decoding>`. `alt=""` is kept: it marks the image as decorative. The hero image has `loading="eager"`; every other image `loading="lazy"`. `decoding` is always `async`.
- `gallery.columns` is `data-columns="{columns}"` on `.hs-gallery__grid` and `embed.aspect_ratio` is `data-ratio="16-9"`, `"4-3"` or `"1-1"` on `.hs-embed__frame`, instead of the inline styles in `design/blocks/gallery.md` and `embed.md`. The page's CSP allows no inline style.
- A `card_list` with `source.kind` `collection` shows the first `page_size` cards, sorted as API-003 says (`created_at` comes from the snapshot). It has no pager. A collection list with no items (the site has one page) is left out entirely.

### Rich text
- `paragraph` → `<p>`, `heading` → `<h2>` or `<h3>`, `bulletList` → `<ul>`, `orderedList` → `<ol>` (with `start="{n}"` only when `start` is not 1), `listItem` → `<li>`, `hardBreak` → `<br>`.
- An empty `paragraph` or `heading` (no `content`) is left out.
- Marks nest in a fixed order, outermost first: `link` → `<a href>`, `bold` → `<strong>`, `italic` → `<em>`.
- Of the `link` mark only `href` is used (API-003). `orderedList`'s `type` is ignored.

### Cards
- Manual cards: the title is plain text, or a link to `action.href` when the card has an `action`; the action label is the `hs-card__action` text as `design/blocks/card_list.md` says.
- Collection cards from `page` (API-003): the title links to the page. There is no action, body or image.

### Contact form
- Each field is a `<label for="hs-b{i}-{name}">` and its control with `id="hs-b{i}-{name}" name="{name}"`, using the elements in `design/blocks/contact_form.md`. A required field adds `required` to the control and `({required})` from Strings to the label.
- The form posts to `action_url` as `application/x-www-form-urlencoded`. No script is added.

### Embed
The stored `url` becomes a privacy-friendly player URL:
- `youtube`: the 11-character video id (`^[A-Za-z0-9_-]{11}$`) from `youtu.be/{id}`, `/watch?v={id}`, `/embed/{id}` or `/shorts/{id}` → `https://www.youtube-nocookie.com/embed/{id}`.
- `vimeo`: the numeric id from `vimeo.com/{id}` or `player.vimeo.com/video/{id}` → `https://player.vimeo.com/video/{id}?dnt=1`.
- `google_maps`: the stored URL as it is.

The iframe is `<iframe src title loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; picture-in-picture" allowfullscreen>`. When no id can be found in a `youtube` or `vimeo` URL, the frame holds `<a class="hs-embed__link" href="{url}">{title}</a>` instead.

## Links
Every `href` from content (`hero.cta`, card actions, rich text links) and every menu link is resolved the same way.

- `https://…` and `mailto:…`: written as stored. No `target`, no `rel`.
- Site paths, matched against the snapshot: `/` is the home page; `/{slug}` is the page with that slug, and the home page's own slug also means the home page.
- A site path that matches no page (renamed or deleted since the link was written) is its text without a link: `<span class="hs-link-missing">`. A published site never has a dead internal link.
- In `release` mode site links are relative, so they work under any site slug. Every release file except the not-found page sits at the site root, so the home page is `./`, a page is `{slug}` and an asset is `assets/{file}`.

## Not-found page
`RenderSite` adds `/404.html`: the site header and menu (no item has `aria-current`), then `<main>` with `<h1 class="hs-page-title">{Not found title}</h1>`, `<p>{Not found text}</p>` and a link `{Back home}` to the home page. Its title is `{Not found title} · {site name}`. Publishing serves it at any unknown path, so it has `<base href="/s/{site.slug}/">` right after `charset`.

## Strings
Built-in text is chosen by the primary subtag of `site.settings.language`. `nl` gets Dutch; every other language gets English.

| Key | `en` | `nl` |
|---|---|---|
| Skip link | Skip to content | Naar de inhoud |
| Main menu | Main menu | Hoofdmenu |
| required | required | verplicht |
| Preview label | Preview · not published | Voorbeeld · niet gepubliceerd |
| Not found title | Page not found | Pagina niet gevonden |
| Not found text | This page does not exist (any more). | Deze pagina bestaat niet (meer). |
| Back home | Back to the home page | Terug naar de startpagina |
| Gallery (block name) | Gallery | Galerij |
| Card list (block name) | Cards | Kaarten |
| Contact form (block name) | Contact form | Contactformulier |

## Security
- Preview responses send `Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com; form-action https:; script-src 'none'; base-uri 'self'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- Built HTML holds no owner-controlled script or style, so this policy never blocks a correct page. That is what makes serving on the API origin safe (ADR 4).
- The template is Hivesite's own code. No owner code runs in a build.

## Tooling
- **Node 24 LTS**, at least 24.15.0, the version CI uses. The Host finds it as `node` on its `PATH`.
- **`web/packages/blocks`** is `@hivesite/blocks`: one Vue 3 single-file component per block type, in TypeScript (strict), styled only with `var(--hs-…)` from `design/tokens.json`. It ships source and has no build of its own.
- **`web/template`** is the default template, `@hivesite/template-default`: the page shell (head, header, menu, footer, not-found page), the stylesheet build from `design/tokens.json` and the block styles, and `render.mjs`. It depends on `@hivesite/blocks` as `file:../packages/blocks`. Both packages are private and never published to npm.
- `npm ci && npm run build` in `web/template` writes `web/template/dist/`: `render.mjs` (a Vite SSR bundle with Vue and every dependency inside, so it runs without `node_modules`), `themes/{key}/` with each theme's stylesheet and fonts, and `themes.json`, the registry Rendering reads (API-010): per theme its `key`, `name`, `description`, `color_scheme`, `version`, `sample` and asset file names.
- The Host's published output carries `web/template/dist/` as `{template_dir}`. Rendering reads `themes.json` once at start and fails to start without it.
- Tests: the HTML snapshot tests are Vitest snapshots in `web/template` (`npm test`). C# tests in `tests/Hivesite.Rendering.Tests` run the built `render.mjs` for the Build contract: modes, release files, limits and errors.

## Rules

### Purity and determinism
- A build reads only its request. `render.mjs` does not read the clock, a random source, the environment, the network or any file outside its own bundle. The same request gives byte-identical output; a test builds the same snapshot twice and compares.
- Snapshot tests cover every block type in every theme, both modes, the not-found page, a page without a hero, and both languages.
- The stylesheet and components use design tokens only. HTML carries classes and `data-` attributes, never values.

### Limits
- A page has at most 40 blocks (API-004) and the menu at most 50 items (API-002).
- Build limits are in Build contract.

### Preview
- Preview calls `GetSiteSnapshotForPage`, then `RenderPage`. `null` from Content is 404 `page_not_found`. Rendering stores nothing and has no database.
- Preview is read-only and raises no events.

### Operation names
- `PreviewPage` (HTTP), `RenderPage` and `RenderSite` (Rendering contract), `GetSiteSnapshot` and `GetSiteSnapshotForPage` (Content contract). Each becomes the `operationId` and the C# method name. Renaming one is a breaking change.

## Agent use
An agent previews with `GET /pages/{id}/preview`, optionally with `?theme=`, and reads the HTML. It is read-only and safe to call any number of times. A 500 `build_failed` may be retried once; a second failure is a bug to report.

## Decisions
- **One default Vue template, run by Node from the Host as trusted code** (ADR 4). No sandbox, because no owner code runs.
- **Preview is synchronous.** A build of one page takes well under a second, so the endpoint returns HTML in the response, not a job to poll. The 10-second limit makes a stuck build fail instead of hang.
- **One Node process per build, request on stdin, response on stdout.** No temp folders and no long-running Node server.
- **Node writes HTML only; Rendering adds the theme assets.** Assets are fixed per theme and deploy, so they are built once, in `npm run build`, not per site.
- **The block markup is in `design/blocks/`, and the bytes in snapshot tests.** Version 1 repeated the markup here and drifted from the design notes. This spec keeps only the rules that cross blocks: ids, headings, escaping, links, images.
- **`data-columns` and `data-ratio`, not inline styles,** so the CSP needs no `'unsafe-inline'`. `design/blocks/gallery.md` and `embed.md` should follow in a design change.
- **`script-src 'none'`.** A built site has no script in this version. API-012 (intro and loader) changes it when it is revised.
- **The snapshot is a small subset of API-005's,** with `snapshot_format` 1, so API-005 can replace it later as format 2 without changing the template's job.
- **Content adds `GetSiteSnapshot` and `GetSiteSnapshotForPage`** to `Hivesite.Content.Contracts`. Rendering never reads Content's data another way.
- **The operation names `RenderPage` and `RenderSite` are kept** from version 1, so API-020 calls the same contract.
- **The studio opens the preview in a new tab.** Showing it inside the studio in an `<iframe>` needs `frame-ancestors` for the studio's origin; not in this version.
- **Not in this version:** list pages and a pager for collection card lists (version 1's `/page/{n}` and `list_page`), display font and corner choices, `@hivesite/composables`, owner templates and the build sandbox (ADR 3), per-site and preview origins, a preview of the whole site as files, caching of builds, a limit on builds running at once, retries, and site assets from API-006.

## Open questions
- none

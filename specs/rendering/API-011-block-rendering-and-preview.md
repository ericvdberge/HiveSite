---
id: API-011
title: Block rendering and draft preview
domain: rendering
status: draft
owner: api-architect
stories: [17, 18]
depends_on: [API-001, API-002, API-003, API-004, API-010]
version: 1
---

> **Held.** This spec is on hold until ADR 3 (sandboxed Vue/Nuxt templates instead of the C# block renderer) is decided. It is kept as written for reference and is not up for approval. Its `brand_styling` references point to an API-001 v3 that was withdrawn; brand styling now comes from the `brand_styling` entity (API-005).

## Purpose
Rendering turns a site's content and brand styling into static HTML, the same way every time. A site owner can see any draft page as HTML before it is published.

Auth, ids, errors, validation and timestamps follow the shared conventions in API-001. Brand styling is in API-001, block types and their attributes in API-003, the blocks document in API-004, themes and tokens in API-010.

## Endpoints

### GET /pages/{id}/preview
Auth: site owner

Query:
- `theme` (optional): a theme key from API-010. Renders with that theme instead of the site's `brand_styling.theme`, without saving it, so an owner can compare themes. The site's `display_font` and `corners` still apply.
- `list_page` (optional): integer from 1, default 1. Which list page to show when the page has a paged collection `card_list` (see Paging).

Renders the page as it is now in Content: current blocks, current menu, current site settings and brand styling. Nothing is stored.

Request
```
GET /pages/01a181d8-810e-7cfa-b14e-65065bb59fa1/preview
```

Response 200

Headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Content-Security-Policy` as in Security below.

The site is Atelier Noor (`language` `nl`, brand styling `atelier` with `from_theme` for both choices, so `<html>` has no `data-display-font` or `data-corners`) with three pages in menu order: Home (`01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0`), About (`01a181d4-5e8b-75fc-bd2f-613219bf3f79`, slug `about`) and Our work (`01a181d8-810e-7cfa-b14e-65065bb59fa1`, slug `our-work`). Our work has a `hero` and a `rich_text` block.
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
<section class="hs-block hs-hero" id="hs-b0" aria-labelledby="hs-b0-title">
<div class="hs-hero__text">
<h1 class="hs-hero__title" id="hs-b0-title">Selected work</h1>
<p class="hs-hero__subtitle">Bowls, vases and tableware.</p>
<a class="hs-button" href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">Meet the maker</a>
</div>
<img class="hs-hero__image" src="https://images.example.com/noor/vases.jpg" alt="Three celadon vases on linen" loading="eager" decoding="async">
</section>
<section class="hs-block hs-rich-text" id="hs-b1">
<p>Every piece is thrown, glazed and fired in <strong>Utrecht</strong>. Read more <a href="/pages/01a181d4-5e8b-75fc-bd2f-613219bf3f79/preview">about the studio</a>.</p>
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
- 400 `invalid_request`: `list_page` is not an integer of 1 or more (`field` `list_page`), or `theme` is empty (`field` `theme`).
- 400 `unknown_theme`: `theme` is not a key from API-010. `field` is `theme`.
- 400 `list_page_out_of_range`: `list_page` is higher than the page's list page count. `field` is `list_page`.
- 401 `unauthenticated`
- 404 `page_not_found`: as in API-002.

## Renderer contract

Rendering offers two pure functions through `Hivesite.Rendering.Contracts`. Preview calls `RenderPage`; Publishing (API-020) calls `RenderSite`. Neither reads a database, the clock or a random source: the caller passes in everything, and the same input always gives byte-identical output.

### Input: a site snapshot
Shown as JSON; in code it is a set of records with the same names in PascalCase.
```json
{
  "mode": "release",
  "site": {
    "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
    "name": "Atelier Noor",
    "slug": "atelier-noor",
    "language": "nl",
    "description": "Handmade ceramics from Utrecht.",
    "brand_styling": {
      "theme": "atelier",
      "display_font": "from_theme",
      "corners": "from_theme"
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
    }
  ]
}
```
- `mode`: `release` or `preview` (see Modes).
- `site.brand_styling`: the site's brand styling as Content returns it (API-001). Preview with a `theme` override passes the override in `site.brand_styling.theme`. The theme's tokens and assets come from the registry in code (API-010), so they are part of the renderer, not of the input.
- `pages`: every page of the site in `menu_order`, each with its stored blocks document (API-004). The caller reads the site, the pages and their blocks in one consistent read through `Hivesite.Content.Contracts`.
- The blocks are trusted: they were validated by API-004 and are not validated again.

### RenderPage(snapshot, page_id, list_page) → HTML
Returns one HTML document as a UTF-8 string. Fails with `list_page_out_of_range` when `list_page` is higher than the page's list page count.

### RenderSite(snapshot) → files
Returns every file of a static site, as a list of `{ "path", "content_type", "bytes" }`, sorted by `path` in ordinal order:

| `path` | What |
|---|---|
| `/` | the home page (`menu_order` 0) |
| `/{page_slug}` | every other page |
| `/page/{n}` | list page `n` (2 or more) of the home page, when it has one |
| `/{page_slug}/page/{n}` | list page `n` (2 or more) of another page |
| `/404.html` | the not-found page (see Not-found page). The `.` keeps it apart from a page with the slug `404` |
| `/assets/{file}` | the theme's stylesheet and fonts (API-010), and later files such as API-012's script |

HTML files have `content_type` `text/html; charset=utf-8`. A snapshot with no pages is an error; Publishing checks for it first (API-020).

## Modes

| | `release` | `preview` |
|---|---|---|
| Links to site pages | relative to the file's own path (see Links) | `/pages/{page_id}/preview`, plus `?list_page={n}` for list pages, plus `theme={key}` when a `theme` override was given |
| Stylesheet and fonts | `assets/{file}`, relative like links | `/themes/{key}/assets/{file}` (API-010) |
| `<meta name="robots" content="noindex">` | no | yes |
| Preview label | no | `<p class="hs-preview-label">` right after the skip link |
| Intro and loader (API-012) | yes | no |

Release HTML never contains the site slug, except in the not-found page's `<base>`. A release therefore stays correct when the site slug changes (API-021).

## Document

Every HTML page has the structure of the example above, in this order:
1. `<!doctype html>`, then `<html lang="{site.language}" data-theme="{theme}">`, where `{theme}` is `brand_styling.theme`. When `display_font` or `corners` is not `from_theme`, `data-display-font="{display_font}"` and then `data-corners="{corners}"` follow `data-theme`, in that order (API-010 Brand styling).
2. `<head>`: `charset`, `viewport`, `robots` (preview only), `generator` (`Hivesite`), `color-scheme` (the theme's `color_scheme`), `<title>`, `description` (left out when `site.description` is `""`), the stylesheet link. Nothing else.
3. `<body>`: skip link to `#hs-main`, preview label (preview only), `<header class="hs-header">` with the site name linked to the home page and the menu, `<main class="hs-main" id="hs-main">` with the blocks, `<footer class="hs-footer">` with the site name.

### Title
- Home page: `{site name}`.
- Other pages: `{page title} · {site name}`.
- List page `n`: `{page title} · {Page n of N} · {site name}`, with the localised string from Strings; for the home page `{Page n of N} · {site name}`.

### Menu
- `<nav class="hs-menu" aria-label="{Main menu}">` with a `<ul>` of every page in `menu_order`. Each item links to the page by its title.
- The current page's link has `aria-current="page"`, also on its list pages.

### Headings
- Exactly one `<h1>` per page. If block 0 is a `hero`, its title is the `<h1>`. Otherwise `<main>` starts with `<h1 class="hs-page-title">{page title}</h1>`, before the first block.
- A `hero` that is not block 0 uses `<h2>` for its title.
- Block headings (`gallery`, `card_list`, `contact_form`) are `<h2>`. Card titles are `<h3>`. Rich text headings keep their level (2 or 3).

### Output format
- UTF-8 without BOM, `\n` line endings, ending in one `\n`.
- One element per line, no indentation, as in the example. Inline content (text and its marks, links, `<br>`) stays on the line of its block element.
- Attributes in the order shown in Blocks; values in double quotes. Boolean attributes (`required`, `allowfullscreen`) have no value.
- No inline `style` attributes, no `<style>` elements, no inline scripts and no event handler attributes.

### Escaping
- Every string from content is HTML-escaped: `&` `<` `>` `"` `'` become `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`. This holds for text and for attribute values, including URLs.
- Rich text `text` is literal (API-003): `<b>` in content is shown as the characters `<b>`.

## Blocks

Every block is one top-level element with `class="hs-block hs-{type}"` (the type with `_` turned into `-`) and `id="hs-b{i}"`, where `i` is the block's 0-based position in the page. Ids inside a block start with that id. A block section with a heading has `aria-labelledby` pointing to it.

Common rules:
- An empty string attribute and a `null` attribute leave out the element that would show them (an empty `subtitle` gives no `<p class="hs-hero__subtitle">`).
- Images: `<img src alt loading decoding>`. `alt=""` is kept as written: it marks the image as decorative. `loading` is `eager` in block 0 and `lazy` in every other block; `decoding` is always `async`.
- A `width`, `layout`, `columns` or `aspect_ratio` attribute becomes a modifier class, as listed below. The layout itself comes from the theme stylesheet and `design/blocks/`.

| Block | Markup |
|---|---|
| `hero` | `<section class="hs-block hs-hero" id aria-labelledby>`, then `<div class="hs-hero__text">` with `<h1\|h2 class="hs-hero__title" id="hs-b{i}-title">`, `<p class="hs-hero__subtitle">`, `<a class="hs-button" href>{cta.label}</a>`; then `<img class="hs-hero__image">` after the div. |
| `rich_text` | `<section class="hs-block hs-rich-text" id>` holding the rich text (see Rich text). No heading id; the block has no `aria-labelledby`. |
| `image` | `<figure class="hs-block hs-image hs-image--{width}" id>` with `<img>` and `<figcaption>`. |
| `gallery` | `<section class="hs-block hs-gallery hs-gallery--cols-{columns}" id aria-labelledby>`, `<h2 class="hs-block__heading" id="hs-b{i}-heading">`, then `<ul class="hs-gallery__grid">` with one `<li><figure><img><figcaption></figure></li>` per image. |
| `card_list` | `<section class="hs-block hs-card-list hs-card-list--{layout}" id aria-labelledby>`, `<h2 class="hs-block__heading" id="hs-b{i}-heading">`, `<ul class="hs-card-list__items">` with one `<li><article class="hs-card">` per card, then the pager (see Paging). |
| `contact_form` | `<section class="hs-block hs-contact-form" id aria-labelledby>`, `<h2 class="hs-block__heading" id="hs-b{i}-heading">`, `<p class="hs-contact-form__intro">`, then `<form class="hs-form" method="post" action="{action_url}">` (see Contact form). |
| `embed` | `<figure class="hs-block hs-embed hs-embed--{ratio}" id>` with `<iframe>` and `<figcaption>` holding the `title`. `ratio` is `16-9`, `4-3` or `1-1`. |

### Rich text
- `paragraph` → `<p>`, `heading` → `<h2>` or `<h3>`, `bulletList` → `<ul>`, `orderedList` → `<ol>` (with `start="{n}"` only when `start` is not 1), `listItem` → `<li>`, `hardBreak` → `<br>`.
- An empty `paragraph` or `heading` (no `content`) is left out.
- Marks nest in a fixed order, outermost first: `link` → `<a href>`, `bold` → `<strong>`, `italic` → `<em>`. Each `text` node is rendered on its own; adjacent nodes with the same mark give adjacent elements.
- A list item's paragraph is rendered as a `<p>` inside the `<li>`.
- Of the `link` mark only `href` is used (API-003). `orderedList`'s `type` is ignored.

### Cards
- An `<article class="hs-card">` holds, in order: `<img class="hs-card__image">`, `<h3 class="hs-card__title">`, `<p class="hs-card__body">`, `<a class="hs-card__action" href>{label}</a>`.
- Manual cards: the title is plain text and the `action`, when set, is the link.
- Collection cards from `page` (API-003): the title is a link to the page and there is no action, body or image.

### Contact form
- One field per line pair: `<label for="hs-b{i}-{name}">{label}</label>`, then the control with `id="hs-b{i}-{name}" name="{name}"`.
- Controls: `text` → `<input type="text">`, `email` → `<input type="email" autocomplete="email">`, `phone` → `<input type="tel" autocomplete="tel">`, `textarea` → `<textarea rows="5"></textarea>`. A required field adds `required` to the control and ` <span class="hs-form__required">({required})</span>` to the label.
- Then `<button class="hs-button" type="submit">{submit_label}</button>`.
- The form posts to `action_url` as `application/x-www-form-urlencoded`. No script is added.

### Embed
The stored `url` becomes a privacy-friendly player URL:
- `youtube`: the 11-character video id (`^[A-Za-z0-9_-]{11}$`) from `youtu.be/{id}`, `/watch?v={id}`, `/embed/{id}` or `/shorts/{id}` → `https://www.youtube-nocookie.com/embed/{id}`.
- `vimeo`: the numeric id from `vimeo.com/{id}` or `player.vimeo.com/video/{id}` → `https://player.vimeo.com/video/{id}?dnt=1`.
- `google_maps`: the stored URL as it is.

The iframe is `<iframe src title loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`. When no id can be found in a `youtube` or `vimeo` URL, the figure holds `<a class="hs-embed__link" href="{url}">{title}</a>` instead of the iframe.

## Links
Every `href` from content (`hero.cta`, card actions, rich text links) and every menu link is resolved the same way.

- `https://…` and `mailto:…`: written as stored. No `target`, no `rel`.
- Site paths, matched against the snapshot:
  - `/` → the home page.
  - `/{slug}` → the page with that slug; the home page's own slug also means the home page.
  - `/page/{n}` and `/{slug}/page/{n}` → that list page, when it exists.
- A site path that matches nothing (a page renamed or deleted since the link was written) is rendered as its text without a link: `<span class="hs-link-missing">`. A published site never has a dead internal link.

In `release` mode a site link is relative to the path of the file it is in, so it works under any site slug:

| File | Prefix | Home | Page `about` | Asset |
|---|---|---|---|---|
| `/` and `/{slug}` | (none) | `./` | `about` | `assets/theme.5f1c9a2e.css` |
| `/page/{n}` | `../` | `../` | `../about` | `../assets/theme.5f1c9a2e.css` |
| `/{slug}/page/{n}` | `../../` | `../../` | `../../about` | `../../assets/theme.5f1c9a2e.css` |

A list page link is `{prefix}{slug}/page/{n}` (or `{prefix}page/{n}` for the home page); list page 1 is the page itself.

## Paging
- A `card_list` with `source.kind` `collection` shows `page_size` cards per list page.
- A page's list page count `N` is the highest `ceil(items / page_size)` over its collection lists, and at least 1. With 49 other pages and `page_size` 12, `N` is 5.
- On list page `n`, every collection list on the page shows its `n`-th slice. A list whose own slice count is lower than `n` shows its heading and a pager with only "previous" to its last slice.
- A list with more than one slice ends with `<nav class="hs-pager" aria-label="{Pages}">`: a "previous" link (`rel="prev"`) when `n` > 1, `<span class="hs-pager__status">{Page n of N}</span>` with the list's own count, and a "next" link (`rel="next"`) when there is a next slice.
- A collection list with no items at all (the site has one page) is left out entirely.
- Manual lists are never paged.
- Sorting follows API-003 (`natural`, `newest`, `title`); `created_at` comes from the snapshot.

## Not-found page
`RenderSite` adds `/404.html`: the site header and menu (no item has `aria-current`), then `<main>` with `<h1 class="hs-page-title">{Not found title}</h1>`, `<p>{Not found text}</p>` and a link to the home page. Its title is `{Not found title} · {site name}`. Because Publishing serves it at any unknown path, it has `<base href="/s/{site.slug}/">` as the first element of `<head>` after `charset`, and its links use the prefix of `/`.

## Strings
Built-in text is chosen by the primary subtag of `site.language`. `nl` gets Dutch; every other language gets English.

| Key | `en` | `nl` |
|---|---|---|
| Skip link | Skip to content | Naar de inhoud |
| Main menu | Main menu | Hoofdmenu |
| Pages | Pages | Pagina's |
| Previous | Previous | Vorige |
| Next | Next | Volgende |
| Page n of N | Page {n} of {N} | Pagina {n} van {N} |
| required | required | verplicht |
| Preview label | Preview · not published | Voorbeeld · niet gepubliceerd |
| Not found title | Page not found | Pagina niet gevonden |
| Not found text | This page does not exist (any more). | Deze pagina bestaat niet (meer). |
| Back home | Back to the home page | Terug naar de startpagina |
| Made with (API-012) | Made with Hivesite | Gemaakt met Hivesite |

## Security
- Preview responses (and the live site, API-021) send `Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com; form-action https:; script-src 'self'; base-uri 'self'; frame-ancestors 'none'`.
- Rendered HTML holds no owner-controlled script or style, so this policy never blocks a correct page.
- `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` on every response.

## Rules

### Purity and determinism
- `RenderPage` and `RenderSite` are pure. Same snapshot (and arguments) in, same bytes out. Snapshot tests cover every block type in every theme, both modes, list pages, the not-found page, and each `display_font` and `corners` value at least once.
- Renderers use design tokens only, through the theme stylesheet's custom properties. HTML carries classes, never values.

### Limits
- A page renders at most 40 blocks (API-004) and 50 menu items (API-002).
- `list_page` in a preview: 1 to the page's `N`. The highest possible `N` is 49 (49 other pages, `page_size` 1).

### Preview
- Preview reads the site with its brand styling, its pages and their blocks in one read through `Hivesite.Content.Contracts`, then calls `RenderPage` with `mode` `preview`. Rendering stores nothing and has no database.
- Preview is read-only and raises no events.
- Preview has no intro, loader or script.

## Decisions
- **The markup in this spec is the contract.** Class names, element order and heading levels are fixed here; `design/blocks/` styles them through the theme stylesheet. A markup change is a new version of this spec.
- **Release HTML uses relative links.** A release does not depend on the site slug, so a slug change reaches the live site without a new publish (API-021).
- **Dead internal links become plain text.** Content does not check site paths (API-003), so Rendering makes sure a published site has none.
- **List pages live at `/{page_slug}/page/{n}`** (and `/page/{n}` for the home page). They cannot clash with page slugs, which are one path segment. All collection lists on one page share the list page number.
- **YouTube embeds use `youtube-nocookie.com` and Vimeo adds `dnt=1`,** so visitors are not tracked until they press play.
- **Built-in strings come in English and Dutch.** Other languages fall back to English until a story adds them.

## Open questions
- none

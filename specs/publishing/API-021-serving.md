---
id: API-021
title: Serving the live site
domain: publishing
status: in review
owner: api-architect
stories: [21]
depends_on: [API-001, API-002, API-011, API-020]
version: 1
---

## Purpose
Anyone can visit a published site at `/s/{site_slug}/` and gets the files of its live release.

Ids and timestamps follow API-001. The files and their paths come from API-011 `RenderSite`; releases and the live pointer from API-020.

## Endpoints

### GET /s/{site_slug}/{path}
Auth: none (public)

Methods: `GET` and `HEAD`. `HEAD` returns the same status and headers as `GET`, without a body.

Request
```
GET /s/atelier-noor/our-work
```

Response 200

Headers:
```
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
ETag: "9f2c4e71b0a85d36"
Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com; form-action https:; script-src 'self'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

The body is the stored file `/our-work` of the live release. For the site and page of the API-011 example it is that page in `release` mode, as API-011 renders it before API-012 adds the intro script and mark:
```html
<!doctype html>
<html lang="nl" data-theme="atelier">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Hivesite">
<meta name="color-scheme" content="dark">
<title>Our work · Atelier Noor</title>
<meta name="description" content="Handmade ceramics from Utrecht.">
<link rel="stylesheet" href="assets/theme.5f1c9a2e.css">
</head>
<body>
<a class="hs-skip" href="#hs-main">Naar de inhoud</a>
<header class="hs-header">
<a class="hs-header__name" href="./">Atelier Noor</a>
<nav class="hs-menu" aria-label="Hoofdmenu">
<ul>
<li><a href="./">Home</a></li>
<li><a href="about">About</a></li>
<li><a href="our-work" aria-current="page">Our work</a></li>
</ul>
</nav>
</header>
<main class="hs-main" id="hs-main">
<section class="hs-block hs-hero" id="hs-b0" aria-labelledby="hs-b0-title">
<div class="hs-hero__text">
<h1 class="hs-hero__title" id="hs-b0-title">Selected work</h1>
<p class="hs-hero__subtitle">Bowls, vases and tableware.</p>
<a class="hs-button" href="about">Meet the maker</a>
</div>
<img class="hs-hero__image" src="https://images.example.com/noor/vases.jpg" alt="Three celadon vases on linen" loading="eager" decoding="async">
</section>
<section class="hs-block hs-rich-text" id="hs-b1">
<p>Every piece is thrown, glazed and fired in <strong>Utrecht</strong>. Read more <a href="about">about the studio</a>.</p>
</section>
</main>
<footer class="hs-footer">
<p class="hs-footer__name">Atelier Noor</p>
</footer>
</body>
</html>
```

Response 304: when `If-None-Match` holds the file's current `ETag`. Same headers, no body.

Response 301: see Redirects. Headers `Location` (a path, no host) and `Cache-Control: public, max-age=300`. No body.

Errors
- 404 `site_not_found`: no site has this slug or a former slug that redirects (see Redirects), or the site has never published.
- 404 `not_found`: the site is live but the release has no file for this path. The body is the release's not-found page (`/404.html`, API-011) with status 404, `Content-Type: text/html; charset=utf-8` and `Cache-Control: public, max-age=0, must-revalidate`.
- 405 `method_not_allowed`: any method other than `GET` and `HEAD`. Header `Allow: GET, HEAD`.

Error bodies: `not_found` is the HTML not-found page. `site_not_found` and `method_not_allowed` have a short plain HTML page (`<!doctype html>`, `<title>` and one `<p>` with the message, in English), because visitors use a browser. A request whose `Accept` header lists `application/json` before `text/html` (or without `text/html`) gets the JSON error shape from `specs/STYLE.md` instead, with the same status and `code`.

## Paths

`{site_slug}` is matched against current and former site slugs. The rest of the path, after `/s/{site_slug}`, maps to a release file:

| Request path | Result |
|---|---|
| `/s/{site_slug}` | 301 to `/s/{site_slug}/` |
| `/s/{site_slug}/` | file `/` (the home page) |
| `/s/{site_slug}/{page_slug}` | file `/{page_slug}`. If `{page_slug}` is the home page's slug: 301 to `/s/{site_slug}/` |
| `/s/{site_slug}/{page_slug}/page/{n}` and `/s/{site_slug}/page/{n}` | that list page file. `n` = 1: 301 to the page itself |
| `/s/{site_slug}/assets/{file}` | that asset file |
| `/s/{site_slug}/404.html` | 404 `not_found` with the not-found page; the file is never served with 200. (`/s/{site_slug}/404` is a page with the slug `404`, if there is one.) |
| a path ending in `/` (other than the site root) | 301 to the same path without the final `/` |
| anything else | 404 `not_found` |

- Paths are matched exactly, case-sensitive, after percent-decoding. `/s/Atelier-Noor/` is not `/s/atelier-noor/`: 404 `site_not_found`.
- `n` matches `^[1-9][0-9]{0,3}$`. `page/01` is not a list page: 404.
- A query string is ignored for matching and kept on a 301 `Location`.
- Paths with `..`, `//`, a percent-encoded `/` or a NUL byte return 404 `not_found` without touching storage.
- Paths longer than 512 characters return 404 `not_found`.
- The home page's slug is known from the release: the page at `menu_order` 0 when it was published. Publishing stores it with the release.

## Redirects

### Former site slugs
- When a site's slug changes (API-001), the live site moves to the new slug at once: releases have relative links (API-011), so nothing is republished.
- Requests to a former slug get 301 to the same path under the current slug: `/s/old-name/about?x=1` → `/s/new-name/about?x=1`.
- A former slug redirects for as long as no site has it as its current slug. When another site takes it, that site wins and the redirect ends for good. If the site later takes back an old slug, that slug is simply current again.
- Former slugs are recorded only once the site has published (API-020 Site slug changes).
- At most 20 former slugs per site are kept; the oldest is dropped first.

### Renamed pages
- A renamed page is not redirected. Its old path returns 404 `not_found` in the next release. The release before stays as it was, so a rollback brings the old path back.

## Rules

### Live release
- Each request reads the live pointer of the site (API-020) and serves from that release only. A publish or rollback is visible to the next request.
- Within one request, all reads use one release. Assets are named by their content hash, so a page from the new release never gets a stylesheet from the old one.

### Caching
- HTML files and the not-found page: `Cache-Control: public, max-age=0, must-revalidate`, and a strong `ETag`: the first 16 hex digits of the SHA-256 of the body, in quotes. `If-None-Match` with a matching value returns 304.
- Assets: `Cache-Control: public, max-age=31536000, immutable`, with the same kind of `ETag`.
- Redirects: `Cache-Control: public, max-age=300`, short because a former slug can be taken by another site.
- Content types: as stored with each file (API-011): HTML `text/html; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.woff2` `font/woff2`, `.js` `text/javascript; charset=utf-8`.

### Security
- Every response, including errors and redirects, has the `Content-Security-Policy`, `X-Content-Type-Options` and `Referrer-Policy` headers shown above.
- No cookies are set or read. Owner credentials are ignored on `/s/` paths.
- The site is served on the same origin as the API. That is safe because release HTML has no owner-controlled script (API-011 Security). Serving sites on their own origin comes with custom domains, a later phase.

### Side effects
- Serving is read-only and raises no events. There is no analytics or access log beyond the Host's request log.

## Decisions
- **The live site follows the current slug at once,** and former slugs redirect with 301. This settles the question API-001 left to Publishing.
- **Renamed pages do not redirect** in this version. Keeping a page path history is a later story.
- **Error pages are HTML for browsers and JSON on request.** Visitors are people with browsers; tools that send `Accept: application/json` get the house error shape.
- **No `robots.txt` or `sitemap.xml`** in this version: under `/s/` every site shares one host, where these files only work at the root. They come with custom domains.
- **`assets` is the release's own folder,** which is why API-002 reserves the page slug `assets`.

## Open questions
- none

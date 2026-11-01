---
id: API-021
title: Serving the live site
domain: publishing
status: in review
owner: api-architect
stories: [21]
depends_on: [API-001, API-002, API-011, API-020]
version: 2
---

## Purpose
Anyone can visit a published site at `/s/{site_slug}/` and gets the files of its live release.

Ids and errors follow API-001. The files and their paths come from API-011 v2 `RenderSite`; releases, their stored files and the live pointer from API-020.

Version 2 follows ADR 4: every site is served from the API origin under `/s/{site_slug}/`, with no per-site origins. It drops version 1's former-slug redirects, list pages, ETags, `HEAD` and the HTML-or-JSON error choice, and sets `script-src 'none'` as API-011 does.

## Endpoints

### GET /s/{site_slug}/{path}
Auth: none (public)

Operation: `ServeSite`

`{path}` is the rest of the URL after `/s/{site_slug}/`. It may be empty and may hold `/`.

Request
```
GET /s/atelier-noor/our-work
```

Response 200

Headers:
```
Content-Type: text/html; charset=utf-8
Cache-Control: no-cache
Content-Security-Policy: default-src 'none'; style-src 'self'; font-src 'self'; img-src https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com; form-action https:; script-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

The body is the stored file `/our-work` of the live release, byte for byte. For the site and page of the API-011 example it is that page in `release` mode (wrapped for reading; the bytes are fixed by API-011's snapshot tests):
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
<section class="hs-hero" id="hs-b0" data-variant="image">
<img class="hs-hero__image" src="https://images.example.com/noor/vases.jpg" alt="Three celadon vases on linen" loading="eager" decoding="async">
<div class="hs-hero__body">
<h1 class="hs-hero__title">Selected work</h1>
<p class="hs-hero__subtitle">Bowls, vases and tableware.</p>
<a class="hs-button" href="about">Meet the maker</a>
</div>
</section>
<section class="hs-rich-text" id="hs-b1">
<div class="hs-prose">
<p>Every piece is thrown, glazed and fired in <strong>Utrecht</strong>. Read more <a href="about">about the studio</a>.</p>
</div>
</section>
</main>
<footer class="hs-footer">
<p class="hs-footer__name">Atelier Noor</p>
</footer>
</body>
</html>
```

An asset, for example `GET /s/atelier-noor/assets/theme.5f1c9a2e.css`, returns 200 with its stored bytes, `Content-Type: text/css; charset=utf-8`, `Cache-Control: public, max-age=31536000, immutable` and the security headers above.

Response 301: `GET /s/atelier-noor` (no final `/`) redirects to `/s/atelier-noor/`. Header `Location: /s/atelier-noor/` (a path, no host, query string kept). No body.

Errors
- 404 `site_not_found`: no site has this slug as its current slug, or the site has no live release (it never published). The body is the JSON error shape of `specs/STYLE.md`, `Content-Type: application/json`.
- 404 `not_found`: the site is live but its live release has no file for this path. The body is the release's not-found page, the stored file `/404.html` (API-011 Not-found page), with `Content-Type: text/html; charset=utf-8`. It has no JSON `code`; the name is for tests and logs.

## Paths

The request path after `/s/{site_slug}` maps to a release file `path` (API-011 Release files):

| Request path | Result |
|---|---|
| `/s/{site_slug}` | 301 to `/s/{site_slug}/` |
| `/s/{site_slug}/` | file `/`, the home page |
| `/s/{site_slug}/{page_slug}` | file `/{page_slug}` |
| `/s/{site_slug}/assets/{file}` | file `/assets/{file}` |
| `/s/{site_slug}/404.html` | 404 `not_found`. The not-found page is never served with 200. |
| anything else | 404 `not_found` |

- The site is found with `GetSiteIdBySlug(site_slug)` on `Hivesite.Content.Contracts` (API-020 Contracts), then its live pointer (API-020). `null` or no live pointer is 404 `site_not_found`.
- The file is found by exact, case-sensitive match of `/{path}` against the live release's file list (API-020 Storage), after percent-decoding. Only a listed file is read from disk, at the place API-020 Storage gives it, so no request path ever becomes a disk path.
- `/s/{site_slug}/` is the folder of the release; its file is `index.html` (API-020 Storage). A path ending in `/` other than the site root, such as `/s/atelier-noor/about/`, is not in the list and is 404 `not_found`.
- The home page is only at `/s/{site_slug}/`. Its own slug, for example `/s/atelier-noor/home`, is not a release file and is 404 `not_found`.
- A query string is ignored for matching.
- Slugs are matched exactly: `/s/Atelier-Noor/` is 404 `site_not_found`.

## Rules

### Live release
- Each request reads the site's live pointer (API-020) and serves from that release only. A publish or rollback is visible to the next request.
- The live site always follows the current slug. After a slug change (API-001) the site is at the new slug at once, without a new publish: release HTML has relative links (API-011 Links). The former slug returns 404 `site_not_found`.

### Content types
- As stored with each file from `RenderSite` (API-011 Release files): HTML `text/html; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.woff2` `font/woff2`. Publishing never guesses a type from a file name.

### Caching
- Assets (`/assets/{file}`): `Cache-Control: public, max-age=31536000, immutable`. Their names carry a content hash (API-010 Assets), so a name always means the same bytes.
- Every other response, HTML, redirects and errors: `Cache-Control: no-cache`, so a publish or rollback shows on the next visit.

### Security
- Every response, including errors and redirects, has the `Content-Security-Policy`, `X-Content-Type-Options` and `Referrer-Policy` headers shown above. The policy is the one of the API-011 preview, with `script-src 'none'`.
- No cookies are set or read. Owner credentials are ignored on `/s/` paths.
- Serving on the API origin is safe because no owner code runs and release HTML holds no script and no owner-controlled style (ADR 4, API-011 Security).

### Methods
- Only `GET` is mapped. Other methods get the framework's 405 with no body.

### Side effects
- Serving is read-only and raises no events. There is no analytics or access log beyond the Host's request log.

### Operation names
- `ServeSite` becomes the `operationId` and the C# method name. Renaming it is a breaking change.

## Decisions
- **One origin, under `/s/{site_slug}/`** (ADR 4). Per-site origins come with ADR 3 or custom domains.
- **The site is looked up by slug in Content on each request** (`GetSiteIdBySlug`, API-020 Contracts), so a slug change reaches the live site at once with no read model and no event handling. Visits are few in the MVP; a local slug table fed by `SiteChanged` can replace the call when they are not.
- **Serving reads the release's file list, never a path built from the request.** No traversal rules are needed.
- **`/404.html` is served with 404 for any unknown path.** Its `<base href="/s/{site_slug}/">` (API-011) makes its links work at any depth. It carries the slug of its build, so after a slug change its links point to the former slug until the next publish.
- **An unknown or unpublished site gets the JSON error shape,** like every other error in the API. A visitor page for it is not in this version.
- **Caching is two rules:** immutable for hashed assets, `no-cache` for everything else.
- **Not in this version:** former-slug redirects, a redirect from the home page's slug to the site root, redirects for a final `/`, `ETag` and 304, `HEAD`, an HTML page for `site_not_found`, list pages (`/page/{n}`), `robots.txt` and `sitemap.xml`, per-site origins, custom domains, and the intro script of API-012 (which changes `script-src` when it is revised).

## Open questions
- none

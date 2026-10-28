---
id: API-002
title: Pages and menu order
domain: content
status: in review
owner: api-architect
stories: [13]
depends_on: [API-001]
version: 1
---

## Purpose
A site owner can create, list, read, update and delete the pages of a site and set their order in the menu.

Auth, ids, errors, validation, lists, idempotency, slugs and timestamps follow the shared conventions in API-001.

## Endpoints

### POST /sites/{id}/pages
Auth: site owner

Headers: `Idempotency-Key` (optional)

Request
```json
{
  "title": "Our work",
  "slug": "our-work"
}
```

Response 201

Headers: `Location: /pages/pg_4n7c1x9k2m5q8w3e`
```json
{
  "id": "pg_4n7c1x9k2m5q8w3e",
  "site_id": "st_8f3k2m9q4x7v1c5b",
  "title": "Our work",
  "slug": "our-work",
  "menu_order": 2,
  "created_at": "2026-10-28T09:30:12Z",
  "updated_at": "2026-10-28T09:30:12Z"
}
```

Errors
- 400 `invalid_request`: body is not JSON, `title` or `slug` is missing, a field has the wrong type, an unknown field is present, or a value breaks a limit in Rules. The message names the field.
- 401 `unauthenticated`
- 404 `site_not_found`
- 409 `slug_taken`: another page of this site already uses this slug.
- 409 `idempotency_key_reused`
- 422 `too_many_pages`: the site already has 50 pages.

### GET /sites/{id}/pages
Auth: site owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /sites/st_8f3k2m9q4x7v1c5b/pages?limit=2
```

Response 200
```json
{
  "items": [
    {
      "id": "pg_9d2f6h1j4k8l0m3n",
      "site_id": "st_8f3k2m9q4x7v1c5b",
      "title": "Home",
      "slug": "home",
      "menu_order": 0,
      "created_at": "2026-10-28T09:20:00Z",
      "updated_at": "2026-10-28T09:20:00Z"
    },
    {
      "id": "pg_1q5w9e3r7t2y6u0i",
      "site_id": "st_8f3k2m9q4x7v1c5b",
      "title": "About",
      "slug": "about",
      "menu_order": 1,
      "created_at": "2026-10-28T09:25:41Z",
      "updated_at": "2026-10-28T09:25:41Z"
    }
  ],
  "next_cursor": "c_eyJvIjoxfQ"
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /pages/{id}
Auth: site owner

Request
```
GET /pages/pg_4n7c1x9k2m5q8w3e
```

Response 200
```json
{
  "id": "pg_4n7c1x9k2m5q8w3e",
  "site_id": "st_8f3k2m9q4x7v1c5b",
  "title": "Our work",
  "slug": "our-work",
  "menu_order": 2,
  "created_at": "2026-10-28T09:30:12Z",
  "updated_at": "2026-10-28T09:30:12Z"
}
```

Errors
- 401 `unauthenticated`
- 404 `page_not_found`: no page with this id, or its site belongs to another owner.

### PATCH /pages/{id}
Auth: site owner

Only `title` and `slug` can change; both are optional. `menu_order` is changed only through `PUT /sites/{id}/menu`, and sending it here returns 400 `invalid_request`. An empty object `{}` changes nothing and returns 200.

Request
```json
{
  "title": "Selected work",
  "slug": "selected-work"
}
```

Response 200
```json
{
  "id": "pg_4n7c1x9k2m5q8w3e",
  "site_id": "st_8f3k2m9q4x7v1c5b",
  "title": "Selected work",
  "slug": "selected-work",
  "menu_order": 2,
  "created_at": "2026-10-28T09:30:12Z",
  "updated_at": "2026-10-28T11:02:09Z"
}
```

Errors
- 400 `invalid_request`: as for POST, or the body contains `menu_order`, `id`, `site_id` or a timestamp.
- 401 `unauthenticated`
- 404 `page_not_found`
- 409 `slug_taken`

### DELETE /pages/{id}
Auth: site owner

Request
```
DELETE /pages/pg_4n7c1x9k2m5q8w3e
```

Response 204

No body.

Errors
- 401 `unauthenticated`
- 404 `page_not_found`: also returned when the page was already deleted.

### PUT /sites/{id}/menu
Auth: site owner

Sets the menu order of every page of the site at once. `page_ids` must list each page of the site exactly once.

Request
```json
{
  "page_ids": [
    "pg_9d2f6h1j4k8l0m3n",
    "pg_4n7c1x9k2m5q8w3e",
    "pg_1q5w9e3r7t2y6u0i"
  ]
}
```

Response 200
```json
{
  "site_id": "st_8f3k2m9q4x7v1c5b",
  "page_ids": [
    "pg_9d2f6h1j4k8l0m3n",
    "pg_4n7c1x9k2m5q8w3e",
    "pg_1q5w9e3r7t2y6u0i"
  ]
}
```

Errors
- 400 `invalid_request`: body is not JSON, `page_ids` is missing or not an array of strings, an unknown field is present, or an id appears more than once.
- 401 `unauthenticated`
- 404 `site_not_found`
- 409 `menu_mismatch`: `page_ids` is not exactly the set of the site's current pages (an id is unknown, belongs to another site, or a page is left out). Nothing changes. The client reloads the pages and tries again.

## Rules

### Page fields
- `id`: `pg_` plus 16 characters, as API-001 Ids. Never changes.
- `site_id`: the site the page belongs to. Never changes; pages cannot move between sites.
- `title`: 1 to 80 characters after trimming. Required on create. Used in the menu and as the page's HTML title.
- `slug`: 1 to 60 characters, slug pattern from API-001. Required on create. Unique within its site; two sites may each have a page `about`. The page is published at `/s/{site_slug}/{page_slug}`.
- `menu_order`: integer from 0, read-only. The pages of a site always have the orders 0, 1, 2, … with no gaps and no duplicates.
- `created_at`, `updated_at`: as API-001. A menu change does not change `updated_at` of the pages.

### Menu
- Every page is in the menu. A new page is added at the end (`menu_order` = current page count).
- The page with `menu_order` 0 is the home page and is served at the site root `/s/{site_slug}/`, whatever its slug.
- Deleting a page removes it from the menu and moves the pages after it up by one, so the orders stay gap-free.
- `PUT /sites/{id}/menu` with an empty array is valid only when the site has no pages.
- `PUT /sites/{id}/menu` is idempotent: sending the same list twice gives the same result.

### Limits
- Max 50 pages per site. Creating the 51st returns 422 `too_many_pages`.
- `page_ids` in a menu request: max 50 entries, the same as the page limit.

### Ordering
- `GET /sites/{id}/pages` returns pages by `menu_order` ascending.

### Deleting
- `DELETE` is permanent. The page's blocks are deleted with it. Releases already published by Publishing keep their copy of the page.
- The last remaining page of a site can be deleted; the site then has no home page.

### Side effects
Raised through `Hivesite.Content.Contracts` after the change is saved:
- `PageChanged { page_id, site_id, change: "created" | "updated" | "deleted" }` on POST, on a PATCH that changes a value, and on DELETE. A no-op PATCH raises nothing.
- `MenuChanged { site_id, page_ids }` on a PUT that changes the order, and after a DELETE or POST changes the menu.

## Open questions
- Should a page be able to stay out of the menu (for example a thank-you page reached only by a link)? This spec puts every page in the menu. Allowing it would add a boolean `in_menu` and make the home page rule depend on it.
- Is "the first page in the menu is the home page" the rule you want, or should the site name its home page explicitly (for example `home_page_id` on the site, a change to API-001)?
- Should page slugs reserve any names that Publishing may need under `/s/{site_slug}/` (for example `assets`)? Publishing has no spec yet; this spec reserves none.

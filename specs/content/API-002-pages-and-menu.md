---
id: API-002
title: Pages and menu order
domain: content
status: built
owner: api-architect
stories: [13]
depends_on: [API-001]
version: 3
---

## Purpose
A site owner can create, list, read, update and delete the pages of a site and set their order in the menu.

Auth, ids, errors, validation, lists, slugs and timestamps follow the shared conventions in API-001.

## Endpoints

### POST /sites/{id}/pages
Auth: site owner

Request
```json
{
  "title": "Our work",
  "slug": "our-work"
}
```

Response 201

Headers: `Location: /pages/01a181d8-810e-7cfa-b14e-65065bb59fa1`
```json
{
  "id": "01a181d8-810e-7cfa-b14e-65065bb59fa1",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "title": "Our work",
  "slug": "our-work",
  "menu_order": 2,
  "created_at": "2026-10-28T09:30:12Z",
  "updated_at": "2026-10-28T09:30:12Z"
}
```

Errors
- 400 `invalid_request`: body is not JSON, `title` or `slug` is missing, a field has the wrong type, an unknown field is present, or a value breaks a limit in Rules. The message names the field.
- 400 `slug_taken`: another page of this site already uses this slug.
- 400 `slug_reserved`: the slug is one of the reserved page slugs in Rules.
- 400 `too_many_pages`: the site already has 50 pages.
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /sites/{id}/pages
Auth: site owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/pages?limit=2
```

Response 200
```json
{
  "items": [
    {
      "id": "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "title": "Home",
      "slug": "home",
      "menu_order": 0,
      "created_at": "2026-10-28T09:20:00Z",
      "updated_at": "2026-10-28T09:20:00Z"
    },
    {
      "id": "01a181d4-5e8b-75fc-bd2f-613219bf3f79",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
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
GET /pages/01a181d8-810e-7cfa-b14e-65065bb59fa1
```

Response 200
```json
{
  "id": "01a181d8-810e-7cfa-b14e-65065bb59fa1",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
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
  "id": "01a181d8-810e-7cfa-b14e-65065bb59fa1",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "title": "Selected work",
  "slug": "selected-work",
  "menu_order": 2,
  "created_at": "2026-10-28T09:30:12Z",
  "updated_at": "2026-10-28T11:02:09Z"
}
```

Errors
- 400 `invalid_request`: as for POST, or the body contains `menu_order`, `id`, `site_id` or a timestamp.
- 400 `slug_taken`
- 400 `slug_reserved`
- 401 `unauthenticated`
- 404 `page_not_found`

### DELETE /pages/{id}
Auth: site owner

Request
```
DELETE /pages/01a181d8-810e-7cfa-b14e-65065bb59fa1
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
    "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
    "01a181d8-810e-7cfa-b14e-65065bb59fa1",
    "01a181d4-5e8b-75fc-bd2f-613219bf3f79"
  ]
}
```

Response 200
```json
{
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "page_ids": [
    "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
    "01a181d8-810e-7cfa-b14e-65065bb59fa1",
    "01a181d4-5e8b-75fc-bd2f-613219bf3f79"
  ]
}
```

Errors
- 400 `invalid_request`: body is not JSON, `page_ids` is missing or not an array of strings, an unknown field is present, or an id appears more than once.
- 400 `menu_mismatch`: `page_ids` is not exactly the set of the site's current pages (an id is unknown, belongs to another site, or a page is left out). Nothing changes. The client reloads the pages and tries again.
- 401 `unauthenticated`
- 404 `site_not_found`

## Rules

### Page fields
- `id`: a UUIDv7, as API-001 Ids. Set by the server, never changes.
- `site_id`: the site the page belongs to. Never changes; pages cannot move between sites.
- `title`: 1 to 80 characters after trimming. Required on create. Used in the menu and as the page's HTML title.
- `slug`: 1 to 60 characters, slug pattern from API-001. Required on create. Unique within its site; two sites may each have a page `about`. The page is published at `/s/{site_slug}/{page_slug}`. The slug `assets` is reserved for Publishing and returns 400 `slug_reserved`.
- `menu_order`: integer from 0, read-only. The pages of a site always have the orders 0, 1, 2, … with no gaps and no duplicates.
- `created_at`, `updated_at`: as API-001. A menu change does not change `updated_at` of the pages.

### Menu
- Every page is in the menu. A new page is added at the end (`menu_order` = current page count).
- The page with `menu_order` 0 is the home page and is served at the site root `/s/{site_slug}/`, whatever its slug.
- Deleting a page removes it from the menu and moves the pages after it up by one, so the orders stay gap-free.
- `PUT /sites/{id}/menu` with an empty array is valid only when the site has no pages.
- `PUT /sites/{id}/menu` is idempotent: sending the same list twice gives the same result.

### Limits
- Max 50 pages per site. Creating the 51st returns 400 `too_many_pages`.
- `page_ids` in a menu request: max 50 entries, the same as the page limit.

### Ordering
- `GET /sites/{id}/pages` returns pages by `menu_order` ascending.

### Deleting
- `DELETE` is permanent. The page's blocks (API-004) are deleted with it. Releases already published by Publishing keep their copy of the page.
- The last remaining page of a site can be deleted; the site then has no home page.

### Side effects
Raised through `Hivesite.Content.Contracts` after the change is saved:
- `PageChanged { page_id, site_id, change: "created" | "updated" | "deleted" }` on POST, on a PATCH that changes a value, and on DELETE. A no-op PATCH raises nothing.
- `MenuChanged { site_id, page_ids }` on a PUT that changes the order, and after a DELETE or POST changes the menu.

## Decisions
- **Every page is in the menu** in this version. Pages hidden from the menu (an `in_menu` flag) come with their own story.
- **The first page in the menu is the home page.** The site does not name its home page.
- **The page slug `assets` is reserved** for files Publishing serves under `/s/{site_slug}/`. Reserving it now means no stored page needs renaming later.

## Open questions
- none

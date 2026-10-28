---
id: API-001
title: Sites
domain: content
status: approved
owner: api-architect
stories: [12]
depends_on: []
version: 3
---

## Purpose
An owner can create, list, read and update their own sites, and choose how they look.

## Version 3: brand styling
Version 3 adds brand styling: the site's theme plus two small style choices, stored by Content. Everything else is unchanged from version 2. The additions are:
- the `brand_styling` field in every site response (marked *v3* in the examples);
- `GET /sites/{id}/brand-styling` and `PATCH /sites/{id}/brand-styling`;
- the Rules section **Brand styling (v3)** and the value `"brand_styling"` for `SiteChanged.change`;
- the Decisions marked *v3*.

Story #12 builds version 2 without these. A follow-up Content story builds them. Request bodies of `POST /sites` and `PATCH /sites/{id}` do not change in version 3.

## Endpoints

### POST /sites
Auth: owner

Headers: `Idempotency-Key` (optional, see Rules)

Request
```json
{
  "name": "Atelier Noor",
  "slug": "atelier-noor",
  "settings": {
    "language": "nl",
    "description": "Handmade ceramics from Utrecht."
  }
}
```

`settings` and each of its fields are optional. Defaults: `language` `"en"`, `description` `""`.

Response 201

Headers: `Location: /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7`
```json
{
  "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "name": "Atelier Noor",
  "slug": "atelier-noor",
  "settings": {
    "language": "nl",
    "description": "Handmade ceramics from Utrecht."
  },
  "brand_styling": {
    "theme": "atelier",
    "display_font": "from_theme",
    "corners": "from_theme"
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T09:14:03Z"
}
```

*v3:* `brand_styling` is in every site response. A new site always starts with the defaults shown here (see Brand styling (v3)). The request body cannot set it; sending `brand_styling` here is an unknown field.

Errors
- 400 `invalid_request`: body is not JSON, a required field is missing, a field has the wrong type, an unknown field is present, or a value breaks a limit in Rules. The message names the field.
- 401 `unauthenticated`: no valid owner credentials.
- 400 `slug_taken`: another site, of any owner, already uses this slug.
- 400 `idempotency_key_reused`: the key was used before with a different body.
- 400 `too_many_sites`: the owner already has 10 sites.

### GET /sites
Auth: owner

Query: `limit` (1 to 100, default 20), `cursor` (from `next_cursor` of the previous page).

Request
```
GET /sites?limit=2
```

Response 200
```json
{
  "items": [
    {
      "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "name": "Atelier Noor",
      "slug": "atelier-noor",
      "settings": {
        "language": "nl",
        "description": "Handmade ceramics from Utrecht."
      },
      "brand_styling": {
        "theme": "atelier",
        "display_font": "from_theme",
        "corners": "from_theme"
      },
      "created_at": "2026-10-28T09:14:03Z",
      "updated_at": "2026-10-28T09:14:03Z"
    },
    {
      "id": "01a17e3c-6a8f-7613-9c0e-bc10fea61b4a",
      "name": "Studio Verhaal",
      "slug": "studio-verhaal",
      "settings": {
        "language": "en",
        "description": ""
      },
      "brand_styling": {
        "theme": "studio",
        "display_font": "serif",
        "corners": "from_theme"
      },
      "created_at": "2026-10-27T16:40:51Z",
      "updated_at": "2026-10-28T08:02:17Z"
    }
  ],
  "next_cursor": "c_eyJjIjoiMjAyNi0xMC0yN1QxNjo0MDo1MVoifQ"
}
```

*v3:* each item has `brand_styling`, as in GET /sites/{id}.

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`: `cursor` is not one this endpoint issued.
- 401 `unauthenticated`

### GET /sites/{id}
Auth: site owner

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7
```

Response 200
```json
{
  "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "name": "Atelier Noor",
  "slug": "atelier-noor",
  "settings": {
    "language": "nl",
    "description": "Handmade ceramics from Utrecht."
  },
  "brand_styling": {
    "theme": "atelier",
    "display_font": "from_theme",
    "corners": "from_theme"
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T09:14:03Z"
}
```

*v3:* `brand_styling` is in the response.

Errors
- 401 `unauthenticated`
- 404 `site_not_found`: no site with this id, or it belongs to another owner.

### PATCH /sites/{id}
Auth: site owner

Only the fields present change. `settings` is merged one level deep: a field left out of `settings` keeps its value. An empty object `{}` changes nothing and returns 200.

Request
```json
{
  "name": "Atelier Noor Ceramics",
  "settings": {
    "description": "Handmade ceramics and glazes from Utrecht."
  }
}
```

Response 200
```json
{
  "id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "name": "Atelier Noor Ceramics",
  "slug": "atelier-noor",
  "settings": {
    "language": "nl",
    "description": "Handmade ceramics and glazes from Utrecht."
  },
  "brand_styling": {
    "theme": "atelier",
    "display_font": "from_theme",
    "corners": "from_theme"
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T10:21:45Z"
}
```

*v3:* `brand_styling` is in the response but not accepted in the request; change it with `PATCH /sites/{id}/brand-styling`.

Errors
- 400 `invalid_request`: as for POST /sites. `null` is not accepted for any field.
- 400 `slug_taken`
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /sites/{id}/brand-styling
*Added in v3.*

Auth: site owner

Returns the site's brand styling on its own: the same object as `brand_styling` in the site. Every field is always present, with its default when the owner never set it.

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/brand-styling
```

Response 200
```json
{
  "theme": "atelier",
  "display_font": "from_theme",
  "corners": "from_theme"
}
```

Errors
- 401 `unauthenticated`
- 404 `site_not_found`

### PATCH /sites/{id}/brand-styling
*Added in v3.*

Auth: site owner

Headers: `Content-Type: application/json`

Only the fields present change; a field left out keeps its value. An empty object `{}` changes nothing and returns 200. The draft preview (API-011) uses the new styling at once. The live site changes only with the next publish (API-020), because releases never change.

Request
```json
{
  "theme": "ivory",
  "corners": "round"
}
```

Response 200
```json
{
  "theme": "ivory",
  "display_font": "from_theme",
  "corners": "round"
}
```

Errors
- 400 `invalid_request`: the body is not a JSON object, a field is not a string, a field is `null`, an unknown field is present, or `display_font` or `corners` is not one of its values in Rules. `field` points at the value, for example `/corners`.
- 400 `unknown_theme`: `theme` is not one of the theme keys in Rules. `field` is `/theme`.
- 401 `unauthenticated`
- 404 `site_not_found`
- 415 `unsupported_media_type`: `Content-Type` is not `application/json`. JSON Patch is not offered for this resource.

## Rules

### Site fields
- `id`: a UUIDv7 (see Ids below). Set by the server, never changes.
- `name`: 1 to 80 characters after trimming whitespace. Required on create.
- `slug`: 3 to 40 characters, pattern `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`. Required on create. Unique across all sites of all owners, because it is the public path `/s/{slug}`. Compared exactly; the pattern already rules out case.
- `settings.language`: a BCP 47 language tag, 2 to 35 characters, pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`. Default `"en"`.
- `settings.description`: 0 to 160 characters. Default `""`. Used as the site's meta description.
- `created_at`, `updated_at`: RFC 3339 timestamps in UTC, second precision. `updated_at` changes on every PATCH that changes a value.
- Every field is always present in responses. No field is ever `null`.
- `brand_styling` (v3): see Brand styling (v3) below.
- Release state is not a site field; it is owned by Publishing.

### Brand styling (v3)
Brand styling is how the site looks: one theme plus two small choices on top of it. Every value names design tokens; none is free CSS, a color or a size. What each value means in tokens is in API-010 (Brand styling) and `design/tokens.json`.

| Field | Values | Default | Meaning |
|---|---|---|---|
| `theme` | `atelier`, `ivory`, `studio` | `atelier` | The theme whose tokens the site uses (API-010). The default is `default_theme` in `design/tokens.json`. |
| `display_font` | `from_theme`, `serif`, `grotesk` | `from_theme` | The font of the hero title and block headings. `from_theme` keeps the theme's `font.display`; `serif` uses Cormorant Garamond and `grotesk` uses Hanken Grotesk. |
| `corners` | `from_theme`, `square`, `subtle`, `round` | `from_theme` | The corners of buttons, cards and media. `from_theme` keeps the theme's `radius` tokens; `square`, `subtle` and `round` use the `radius` tokens of `studio`, `atelier` and `ivory`. |

- Exactly these three fields. Each is a string from its list, compared exactly. Every field is always present in responses and never `null`.
- Every value has a default, so a site that never set brand styling renders. Sites created before v3 have the defaults.
- Brand styling is written only through `PATCH /sites/{id}/brand-styling`. `POST /sites` and `PATCH /sites/{id}` keep their v2 request bodies and reject `brand_styling` as an unknown field.
- A PATCH that changes a value updates the site's `updated_at`. A PATCH that sends only the values the site already has changes nothing: 200, the same `updated_at`, no event.
- `PATCH /sites/{id}/brand-styling` is idempotent and takes no `Idempotency-Key`.
- **Storage.** Content stores brand styling as one `jsonb` column `brand_styling` on its `sites` table, `NOT NULL`, with the three defaults as the column default. On read, a field missing from the stored JSON takes its default, so adding a field later needs no data migration.
- **Contracts.** `Hivesite.Content.Contracts` holds the allowed values as enums (`ThemeKey`, `DisplayFont`, `Corners`) and the record `BrandStyling { Theme, DisplayFont, Corners }`. It offers `GetBrandStyling(site_id)`, and the site in the one consistent read of a site, its pages and blocks (used by API-011 and API-020) carries `BrandStyling`. Rendering reads brand styling only this way and stores nothing.
- Rendering's theme registry (API-010) has exactly one theme per `ThemeKey` value. Adding a theme changes both specs.

### Limits
- Max 10 sites per owner. Creating the 11th returns 400 `too_many_sites`.
- Sites cannot be deleted in this version.

### Ordering
- `GET /sites` returns the owner's sites newest first by `created_at`, ties broken by `id` ascending.

### Side effects
- A successful POST or a PATCH that changes a value raises `SiteChanged { site_id, change: "created" | "updated" }` through `Hivesite.Content.Contracts`. A no-op PATCH raises nothing.
- *v3:* a `PATCH /sites/{id}/brand-styling` that changes a value raises `SiteChanged { site_id, change: "brand_styling" }`, adding the value `"brand_styling"` to `change`. A no-op PATCH raises nothing.

### Shared conventions (API-002 to API-004 reuse these)
- **Auth.** Every endpoint needs an authenticated owner. `Auth: owner` means any authenticated owner; `Auth: site owner` means the owner of the site the resource belongs to. Missing or invalid credentials return 401 `unauthenticated`. A resource owned by someone else returns the same 404 as a missing one, never 403, so ids do not leak.
- **Ids.** Every id is a UUIDv7 in lowercase canonical form (8-4-4-4-12 hex digits), for example `01a181c9-b7ca-70bc-abf5-a9e81e300af7`, as in `specs/STYLE.md`. UUIDv7 is time-ordered, so new rows append to the end of the primary key index, which keeps inserts and index scans fast. The server generates ids; clients treat them as opaque. Ids in paths and bodies are accepted in any letter case and always returned lowercase. A value that is not a UUID returns the resource's 404.
- **Errors.** Always `{ "error": { "code": "…", "message": "…" } }` as in `specs/STYLE.md`. `message` is for humans and may change; clients branch on `code` only. When an error is caused by one input, `error.field` holds a JSON Pointer (RFC 6901) to it in the request body, for example `"/settings/description"` or `"/content/2/attrs/title"`, or the name of the query parameter or header, for example `"limit"` or `"If-Match"`. `field` is left out when no single input is to blame (401, 404, `too_many_sites`).
- **Validation.** Request bodies are strict: unknown fields, wrong types and `null` values return 400 `invalid_request`. The one exception is Tiptap documents (API-003, API-004), where `null` marks an unset attribute. String lengths count Unicode code points after trimming leading and trailing whitespace; the trimmed value is stored.
- **Status codes.** 400 for every request the client can fix by changing it: malformed or invalid values, and checks against stored state such as a taken slug, a reused idempotency key or a count limit. 404 for a missing resource. 412 and 428 only for `If-Match` (API-004), 413 for a body over its size limit, 415 for an unsupported `Content-Type`. Clients branch on `code`, not on the status.
- **Lists.** `?limit=` 1 to 100, default 20; `?cursor=` opaque. Responses are `{ "items": [...], "next_cursor": "…" }`; `next_cursor` is `null` on the last page. An unknown or tampered cursor returns 400 `invalid_cursor`.
- **Idempotency.** Endpoints that create something accept an optional `Idempotency-Key` header, 1 to 255 printable ASCII characters. Keys are scoped per owner and kept for 24 hours. A repeat with the same key and the same body returns the original status and body without creating anything. A repeat with the same key and a different body returns 400 `idempotency_key_reused`. Without the header, every request creates.
- **Slugs.** Slug fields use the pattern `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`. Each spec sets the length and the scope of uniqueness. A taken slug returns 400 `slug_taken`.
- **Timestamps.** RFC 3339, UTC, second precision, `Z` suffix.

## Decisions
- **Authentication is out of scope.** The Host resolves an owner id from the request or returns 401 `unauthenticated`. How owners sign up and sign in belongs to a later spec.
- **A site's slug can change at any time**, also after the site is published. Content does not track releases. How a new slug reaches the live site, and whether the old path redirects, belongs to the Publishing specs (API-020, API-021).
- **Errors name the failing input in `field`.** See Errors in Shared conventions.
- **`language` and `description` are the only site settings** in this version. More (favicon, social links, footer text) come with their own stories.
- *v3:* **Content owns brand styling**, as the owner asked: one `brand_styling` section on the site, stored as a JSON column, easy to fetch with the site or on its own. Rendering stays pure and has no database; it reads brand styling through `Hivesite.Content.Contracts`.
- *v3:* **Brand styling has its own endpoint** and is not written through `PATCH /sites/{id}`. The v2 site requests stay as they are, so story #12 is not affected, and the admin's style screen gets one small resource.
- *v3:* **Two choices on top of the theme, both made of tokens.** A display font and a corner style change the feel of a site most for the least risk. Owner colors are left out: every color pair in a theme is contrast-tested (API-010), and free colors would break that. More choices come with their own stories and design tokens.

## Open questions
- none

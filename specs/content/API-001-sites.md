---
id: API-001
title: Sites
domain: content
status: in review
owner: api-architect
stories: [12]
depends_on: []
version: 2
---

## Purpose
An owner can create, list, read and update their own sites.

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
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T09:14:03Z"
}
```

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
      "created_at": "2026-10-27T16:40:51Z",
      "updated_at": "2026-10-28T08:02:17Z"
    }
  ],
  "next_cursor": "c_eyJjIjoiMjAyNi0xMC0yN1QxNjo0MDo1MVoifQ"
}
```

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
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T09:14:03Z"
}
```

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
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T10:21:45Z"
}
```

Errors
- 400 `invalid_request`: as for POST /sites. `null` is not accepted for any field.
- 400 `slug_taken`
- 401 `unauthenticated`
- 404 `site_not_found`

## Rules

### Site fields
- `id`: a UUIDv7 (see Ids below). Set by the server, never changes.
- `name`: 1 to 80 characters after trimming whitespace. Required on create.
- `slug`: 3 to 40 characters, pattern `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`. Required on create. Unique across all sites of all owners, because it is the public path `/s/{slug}`. Compared exactly; the pattern already rules out case.
- `settings.language`: a BCP 47 language tag, 2 to 35 characters, pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`. Default `"en"`.
- `settings.description`: 0 to 160 characters. Default `""`. Used as the site's meta description.
- `created_at`, `updated_at`: RFC 3339 timestamps in UTC, second precision. `updated_at` changes on every PATCH that changes a value.
- Every field is always present in responses. No field is ever `null`.
- The theme is not a site field. It is set through Rendering (`PUT /sites/{id}/theme`). Release state is owned by Publishing.

### Limits
- Max 10 sites per owner. Creating the 11th returns 400 `too_many_sites`.
- Sites cannot be deleted in this version.

### Ordering
- `GET /sites` returns the owner's sites newest first by `created_at`, ties broken by `id` ascending.

### Side effects
- A successful POST or a PATCH that changes a value raises `SiteChanged { site_id, change: "created" | "updated" }` through `Hivesite.Content.Contracts`. A no-op PATCH raises nothing.

### Shared conventions (API-002 to API-004 reuse these)
- **Auth.** Every endpoint needs an authenticated owner. `Auth: owner` means any authenticated owner; `Auth: site owner` means the owner of the site the resource belongs to. Missing or invalid credentials return 401 `unauthenticated`. A resource owned by someone else returns the same 404 as a missing one, never 403, so ids do not leak.
- **Ids.** Every id is a UUIDv7 in lowercase canonical form (8-4-4-4-12 hex digits), for example `01a181c9-b7ca-70bc-abf5-a9e81e300af7`, as in `specs/STYLE.md`. UUIDv7 is time-ordered, so new rows append to the end of the primary key index, which keeps inserts and index scans fast. The server generates ids; clients treat them as opaque. Ids in paths and bodies are accepted in any letter case and always returned lowercase. A value that is not a UUID returns the resource's 404.
- **Errors.** Always `{ "error": { "code": "…", "message": "…" } }` as in `specs/STYLE.md`. `message` is for humans and may change; clients branch on `code` only.
- **Validation.** Request bodies are strict: unknown fields, wrong types and `null` values return 400 `invalid_request`. The one exception is Tiptap documents (API-003, API-004), where `null` marks an unset attribute. String lengths count Unicode code points after trimming leading and trailing whitespace; the trimmed value is stored.
- **Status codes.** 400 for every request the client can fix by changing it: malformed or invalid values, and checks against stored state such as a taken slug, a reused idempotency key or a count limit. 404 for a missing resource. 412 and 428 only for `If-Match` (API-004), 413 for a body over its size limit, 415 for an unsupported `Content-Type`. Clients branch on `code`, not on the status.
- **Lists.** `?limit=` 1 to 100, default 20; `?cursor=` opaque. Responses are `{ "items": [...], "next_cursor": "…" }`; `next_cursor` is `null` on the last page. An unknown or tampered cursor returns 400 `invalid_cursor`.
- **Idempotency.** Endpoints that create something accept an optional `Idempotency-Key` header, 1 to 255 printable ASCII characters. Keys are scoped per owner and kept for 24 hours. A repeat with the same key and the same body returns the original status and body without creating anything. A repeat with the same key and a different body returns 400 `idempotency_key_reused`. Without the header, every request creates.
- **Slugs.** Slug fields use the pattern `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`. Each spec sets the length and the scope of uniqueness. A taken slug returns 400 `slug_taken`.
- **Timestamps.** RFC 3339, UTC, second precision, `Z` suffix.

## Open questions
- How do owners authenticate (API key, bearer token from an identity provider, or cookie session for the admin), and which spec owns sign-up and sign-in? This spec only assumes the Host resolves an owner id or returns 401.
- Can an owner change a site's slug after it has been published? If yes, the old `/s/{slug}` stops working at once (no redirect). If no, PATCH should return 400 `slug_locked` once the site has a release.
- Should the error shape gain an optional `error.field` (for example `"settings.description"` or `"/content/2/attrs/title"`) so clients can point at the failing input? Today the field is only named in `message`.
- Are `language` and `description` the right site settings for the MVP, or are more needed now (for example favicon, social links, footer text)?

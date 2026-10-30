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
An owner can create, list, read and update their own sites.

## Endpoints

### POST /sites
Auth: owner

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
  "next_cursor": "01a17e3c-6a8f-7613-9c0e-bc10fea61b4a"
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit` when the number is out of range; a value that is not a number returns the error without `field`.
- 400 `invalid_cursor`: `cursor` is not the id of one of the owner's sites. `field` is `cursor`.
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
- 400 `invalid_request`: as for POST /sites. A field sent as `null` is treated as not sent.
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
- Max 10 sites per owner. Creating the 11th returns 400 `too_many_sites`. The count is checked before the insert, without a lock, so two requests at the same moment can both pass it. This is accepted for now.
- Sites cannot be deleted in this version.

### Ordering
- `GET /sites` returns the owner's sites newest first by `created_at`, ties broken by `id` ascending.

### Side effects
- A successful POST or a PATCH that changes a value raises `SiteChanged { site_id, change: "created" | "updated" }` through `Hivesite.Content.Contracts`. A no-op PATCH raises nothing.

### Shared conventions (API-002 to API-004 reuse these)
- **Auth.** Every endpoint needs an authenticated owner. `Auth: owner` means any authenticated owner; `Auth: site owner` means the owner of the site the resource belongs to. Missing or invalid credentials return 401 `unauthenticated`. A resource owned by someone else returns the same 404 as a missing one, never 403, so ids do not leak.
- **Ids.** Every id is a UUIDv7 in lowercase canonical form (8-4-4-4-12 hex digits), for example `01a181c9-b7ca-70bc-abf5-a9e81e300af7`, as in `specs/STYLE.md`. UUIDv7 is time-ordered, so new rows append to the end of the primary key index, which keeps inserts and index scans fast. The server generates ids; clients treat them as opaque. Ids in paths and bodies are accepted in any letter case and always returned lowercase. A value that is not a UUID returns the resource's 404.
- **Errors.** Always `{ "error": { "code": "…", "message": "…" } }` as in `specs/STYLE.md`. `message` is for humans and may change; clients branch on `code` only. When an error is caused by one input, `error.field` holds a JSON Pointer (RFC 6901) to it in the request body, for example `"/settings/description"` or `"/content/2/attrs/title"`, or the name of the query parameter or header, for example `"limit"` or `"If-Match"`. `field` is left out when no single input is to blame (401, 404, `too_many_sites`).
- **Validation.** Request bodies are strict: unknown fields and wrong types return 400 `invalid_request`. In a POST, a required field sent as `null` counts as missing. In a PATCH, `null` means the field was not sent. The one exception is Tiptap documents (API-003, API-004), where `null` marks an unset attribute. String lengths count Unicode code points after trimming leading and trailing whitespace; the trimmed value is stored.
- **Status codes.** 400 for every request the client can fix by changing it: malformed or invalid values, and checks against stored state such as a taken slug or a count limit. 404 for a missing resource. 412 and 428 only for `If-Match` (API-004), 413 for a body over its size limit, 415 for an unsupported `Content-Type`. Clients branch on `code`, not on the status.
- **Lists.** `?limit=` 1 to 100, default 20; `?cursor=` is the `next_cursor` of the previous page. Responses are `{ "items": [...], "next_cursor": "…" }`; `next_cursor` is the id of the last item, or `null` on the last page. Clients treat it as opaque. A cursor that is not the id of an item the caller can list returns 400 `invalid_cursor`. It is not signed: knowing an id of your own gives nothing you could not list anyway.
- **Idempotency.** Not in this version. Every POST creates, and there is no `Idempotency-Key` header. Keys may come back with their own spec change.
- **Slugs.** Slug fields use the pattern `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`. Each spec sets the length and the scope of uniqueness. A taken slug returns 400 `slug_taken`.
- **Timestamps.** RFC 3339, UTC, second precision, `Z` suffix.

## Decisions
- **Authentication is out of scope.** The Host resolves an owner id from the request or returns 401 `unauthenticated`. How owners sign up and sign in belongs to a later spec.
- **A site's slug can change at any time**, also after the site is published. Content does not track releases. How a new slug reaches the live site, and whether the old path redirects, belongs to the Publishing specs (API-020, API-021).
- **Errors name the failing input in `field`.** See Errors in Shared conventions.
- **`language` and `description` are the only site settings** in this version. More (favicon, social links, footer text) come with their own stories.

- **The first build is kept simple (v3).** No idempotency keys, `null` in a PATCH means "not sent", the site limit is not race-safe, and the cursor is the last site's id instead of a signed token. Each can return with its own story when it is needed.

## Open questions
- none

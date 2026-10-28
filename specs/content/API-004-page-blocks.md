---
id: API-004
title: Page blocks
domain: content
status: in review
owner: api-architect
stories: [15]
depends_on: [API-001, API-002, API-003]
version: 1
---

## Purpose
A site owner can read and replace the ordered blocks of a page. Each block's data is validated against its block type's schema.

Auth, errors, validation and timestamps follow the shared conventions in API-001. Pages are defined in API-002, block types and their schemas in API-003.

## Endpoints

### PUT /pages/{id}/blocks
Auth: site owner

Replaces all blocks of the page with the list sent. The order of the list is the order on the page.

Request
```json
{
  "blocks": [
    {
      "type": "hero",
      "data": {
        "title": "Made slowly, by hand",
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "text",
      "data": {
        "heading": "The studio",
        "body": "Every piece is thrown, glazed and fired in **Utrecht**."
      }
    }
  ]
}
```

Response 200

Defaults from the schemas are filled in (`hero.subtitle` here).
```json
{
  "page_id": "pg_9d2f6h1j4k8l0m3n",
  "blocks": [
    {
      "type": "hero",
      "data": {
        "title": "Made slowly, by hand",
        "subtitle": "",
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "text",
      "data": {
        "heading": "The studio",
        "body": "Every piece is thrown, glazed and fired in **Utrecht**."
      }
    }
  ],
  "updated_at": "2026-10-28T11:40:27Z"
}
```

Errors
- 400 `invalid_request`: body is not JSON, `blocks` is missing or not an array, a block is not an object, a block lacks `type` or `data`, `data` is not an object, or an unknown field is present at the top level or on a block.
- 400 `unknown_block_type`: a block's `type` is not one of the API-003 types. The message names the block index, for example `blocks[3].type`.
- 400 `invalid_block`: a block's `data` fails its schema or a check from API-003 "Rules beyond the schemas". The message names the block index and the field path, for example `blocks[0].data.title: must be at most 80 characters`.
- 401 `unauthenticated`
- 404 `page_not_found`: as in API-002.
- 413 `request_too_large`: the body is larger than 256 KB.
- 422 `too_many_blocks`: more than 40 blocks.

### GET /pages/{id}/blocks
Auth: site owner

Request
```
GET /pages/pg_9d2f6h1j4k8l0m3n/blocks
```

Response 200
```json
{
  "page_id": "pg_9d2f6h1j4k8l0m3n",
  "blocks": [
    {
      "type": "hero",
      "data": {
        "title": "Made slowly, by hand",
        "subtitle": "",
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "text",
      "data": {
        "heading": "The studio",
        "body": "Every piece is thrown, glazed and fired in **Utrecht**."
      }
    }
  ],
  "updated_at": "2026-10-28T11:40:27Z"
}
```

A new page has `"blocks": []`, and `updated_at` equals the page's `updated_at`.

Errors
- 401 `unauthenticated`
- 404 `page_not_found`

## Rules

### Blocks
- A block is `{ "type": "…", "data": { … } }`. Blocks have no id; a block is known by its index in the list.
- `blocks` is not paginated. It always holds the page's complete list, max 40.
- `updated_at` is the page's `updated_at` from API-002. A PUT that changes the blocks sets it; a PUT with the same blocks as stored changes nothing and keeps it.

### Limits
- 0 to 40 blocks per page. An empty list is valid and clears the page. 41 or more returns 422 `too_many_blocks`.
- Request body max 256 KB (262,144 bytes). Larger returns 413 `request_too_large` before any validation.
- Per-block limits are those in the API-003 schemas.

### Validation
- Checks run in this order, and the first failure is returned: body size, body shape (`invalid_request`), block count (`too_many_blocks`), then each block in list order: `type` (`unknown_block_type`), then `data` (`invalid_block`).
- `data` is checked against the schema of its `type` with a JSON Schema draft 2020-12 validator, then against API-003 "Rules beyond the schemas".
- Strings in `data` are trimmed before they are checked and stored, as in API-001.
- Optional fields left out get their schema `default` before storage. Responses always show the stored data, defaults included.
- Validation is all or nothing: if any block fails, nothing is stored.
- The stored data is valid against the schema of the block type `version` it was checked with. Rendering trusts it and does not validate again.

### Writes
- PUT is idempotent: the same body twice gives the same stored blocks and the same response. It takes no `Idempotency-Key`.
- Last write wins. There is no version check between two PUTs on the same page.

### Side effects
- A PUT that changes the stored blocks raises `PageChanged { page_id, site_id, change: "blocks" }` through `Hivesite.Content.Contracts`, adding the value `"blocks"` to the `change` field defined in API-002. A PUT that changes nothing raises nothing.

## Open questions
- Is last-write-wins acceptable, or should PUT take an `If-Match` header with the page's `updated_at` (or an ETag) to stop the admin overwriting newer blocks from another browser tab?
- `GET /pages/{id}/blocks` is not in the plan's endpoint list, but without it an owner cannot read back the blocks they set. Keep it, or return `blocks` from `GET /pages/{id}` instead (a change to API-002)?

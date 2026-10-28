---
id: API-004
title: Page blocks
domain: content
status: in review
owner: api-architect
stories: [15]
depends_on: [API-001, API-002, API-003]
version: 2
---

## Purpose
A site owner can read a page's blocks as one Tiptap document, replace it, or change only part of it with a JSON Patch. Every block is validated against its block type's schema.

Auth, errors, validation and timestamps follow the shared conventions in API-001. Pages are defined in API-002; block types, their schemas and the Tiptap mapping in API-003.

## The blocks document

The blocks of a page are one resource, `/pages/{id}/blocks`. Its representation is a Tiptap document whose top-level nodes are the blocks, in page order:
```json
{
  "type": "doc",
  "content": [
    { "type": "hero", "attrs": { "title": "…", "subtitle": "", "image": null, "cta": null } },
    { "type": "rich_text", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "…" }] }] }
  ]
}
```
GET returns it, PUT replaces it, and PATCH paths point into it (`/content/0/attrs/title`). The admin can pass it straight to Tiptap and send `editor.getJSON()` back.

Every response carries an `ETag` header with the document's version, for example `ETag: "7"`. PATCH must send it back in `If-Match`; PUT may (see Concurrency).

## Endpoints

### GET /pages/{id}/blocks
Auth: site owner

Request
```
GET /pages/01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0/blocks
```

Response 200

Headers: `ETag: "7"`
```json
{
  "type": "doc",
  "content": [
    {
      "type": "hero",
      "attrs": {
        "title": "Made slowly, by hand",
        "subtitle": "",
        "image": null,
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "rich_text",
      "content": [
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "The studio" }] },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Every piece is thrown, glazed and fired in " },
            { "type": "text", "marks": [{ "type": "bold" }], "text": "Utrecht" },
            { "type": "text", "text": "." }
          ]
        }
      ]
    }
  ]
}
```

A new page has `{ "type": "doc", "content": [] }` and `ETag: "1"`.

Errors
- 401 `unauthenticated`
- 404 `page_not_found`: as in API-002.

### PUT /pages/{id}/blocks
Auth: site owner

Headers: `Content-Type: application/json`, `If-Match` (optional, see Concurrency)

Replaces the whole document. Use it for a first save, to restore a document, or from a client that does not compute patches.

Request
```json
{
  "type": "doc",
  "content": [
    {
      "type": "hero",
      "attrs": {
        "title": "Made slowly, by hand",
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "rich_text",
      "content": [
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "The studio" }] },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Every piece is thrown, glazed and fired in " },
            { "type": "text", "marks": [{ "type": "bold" }], "text": "Utrecht" },
            { "type": "text", "text": "." }
          ]
        }
      ]
    }
  ]
}
```

Response 200

Headers: `ETag: "7"`

The stored document, with defaults filled in (`hero.attrs.subtitle` and `hero.attrs.image` here). The body is exactly the GET response example above.

Errors
- 400 `invalid_request`: body is not JSON, the top level is not an object with `type` `"doc"` and an array `content`, a block is not an object or lacks `type`, an unknown field is present at the top level, or `If-Match` is `*` or holds more than one value.
- 400 `unknown_block_type`: a block's `type` is not one of the API-003 types. The message names the block by JSON Pointer, for example `/content/3/type`.
- 400 `invalid_block`: a block fails its schema or a check from API-003 "Rules beyond the schemas". The message names the JSON Pointer and the problem, for example `/content/0/attrs/title: must be at most 80 characters`.
- 400 `too_many_blocks`: more than 40 blocks.
- 401 `unauthenticated`
- 404 `page_not_found`
- 412 `precondition_failed`: `If-Match` was sent and is not the current `ETag`. Nothing changes.
- 413 `request_too_large`: the body is larger than 256 KB.
- 415 `unsupported_media_type`: `Content-Type` is not `application/json`.

### PATCH /pages/{id}/blocks
Auth: site owner

Headers: `Content-Type: application/json-patch+json`, `If-Match` (required)

Applies a JSON Patch (RFC 6902) to the document, so the admin sends only what changed. Paths are JSON Pointers (RFC 6901) into the document as GET returns it.

Request
```
PATCH /pages/01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0/blocks
Content-Type: application/json-patch+json
If-Match: "7"
```
```json
[
  { "op": "test", "path": "/content/0/type", "value": "hero" },
  { "op": "replace", "path": "/content/0/attrs/subtitle", "value": "Ceramics from Utrecht" },
  {
    "op": "add",
    "path": "/content/-",
    "value": {
      "type": "card_list",
      "attrs": { "heading": "Explore", "source": { "kind": "collection", "entity_type": "page" } }
    }
  },
  { "op": "move", "from": "/content/2", "path": "/content/1" }
]
```

Response 200

Headers: `ETag: "8"`

The whole stored document after the patch, with defaults filled in, so the client can resync.
```json
{
  "type": "doc",
  "content": [
    {
      "type": "hero",
      "attrs": {
        "title": "Made slowly, by hand",
        "subtitle": "Ceramics from Utrecht",
        "image": null,
        "cta": { "label": "See the work", "href": "/our-work" }
      }
    },
    {
      "type": "card_list",
      "attrs": {
        "heading": "Explore",
        "layout": "grid",
        "source": { "kind": "collection", "entity_type": "page", "sort": "natural", "page_size": 12 }
      }
    },
    {
      "type": "rich_text",
      "content": [
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "The studio" }] },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Every piece is thrown, glazed and fired in " },
            { "type": "text", "marks": [{ "type": "bold" }], "text": "Utrecht" },
            { "type": "text", "text": "." }
          ]
        }
      ]
    }
  ]
}
```

Errors
- 400 `invalid_request`: body is not JSON, `If-Match` is `*` or holds more than one value.
- 400 `invalid_patch`: the body is not a JSON Patch array, an operation is malformed (unknown `op`, missing `path`, `from` or `value`, a pointer that is not valid RFC 6901), or an operation cannot be applied (its `path` or `from` does not exist, or a `move` into its own child). The message names the operation, for example `operations[2]: path /content/9 does not exist`.
- 400 `patch_test_failed`: a `test` operation did not match. The message names the operation.
- 400 `too_many_operations`: more than 200 operations.
- 400 `invalid_request`, `unknown_block_type`, `invalid_block`, `too_many_blocks`: the patched document fails a check, exactly as for PUT. Pointers in the message are into the patched document.
- 400 `document_too_large`: the patched document is larger than 256 KB.
- 401 `unauthenticated`
- 404 `page_not_found`
- 412 `precondition_failed`: `If-Match` is not the current `ETag`. Nothing changes. The client reloads with GET and computes its patch again.
- 413 `request_too_large`: the patch body is larger than 256 KB.
- 415 `unsupported_media_type`: `Content-Type` is not `application/json-patch+json`.
- 428 `precondition_required`: no `If-Match` header.

## Rules

### Document
- The document is `{ "type": "doc", "content": [ … ] }` with no other fields. `content` holds only block nodes from API-003; rich text nodes appear only inside a `rich_text` block. Responses always include `content`, also when it is `[]`.
- Blocks have no id; a block is known by its position in `content`. `If-Match` makes positions safe to use in patches.
- `content` is not paginated. It always holds the page's complete list, max 40 blocks.
- A change to the blocks sets the page's `updated_at` (API-002). A PUT or PATCH whose result equals the stored document changes nothing: same `ETag`, same `updated_at`, no event.

### Limits
- 0 to 40 blocks per page. An empty `content` is valid and clears the page. 41 or more returns 400 `too_many_blocks`.
- Request body max 256 KB (262,144 bytes) for PUT and PATCH. Larger returns 413 `request_too_large` before any parsing.
- Stored document max 256 KB, measured as compact UTF-8 JSON. A PATCH whose result is larger returns 400 `document_too_large`.
- Max 200 operations per PATCH.
- Per-block limits are those in the API-003 schemas and rules.

### Concurrency
- Each page's document has a version, an integer that is 1 when the page is created and goes up by 1 on every change. The `ETag` is that integer in quotes, a strong ETag. Clients treat it as opaque and compare it exactly; a weak ETag (`W/"7"`) never matches.
- PATCH requires `If-Match` with exactly one ETag. Without it: 428 `precondition_required`. Stale: 412 `precondition_failed`.
- PUT takes an optional `If-Match`. With it, a stale value returns 412 and nothing changes. Without it, the PUT overwrites whatever is stored (last write wins). The admin sends `If-Match` on every PUT; only a deliberate "overwrite" sends none.
- The check and the write happen in one transaction, so two writes with the same `If-Match` cannot both succeed.

### Patch
- All six RFC 6902 operations are supported: `add`, `remove`, `replace`, `move`, `copy`, `test`.
- Operations apply in order to a copy of the stored document. If any operation fails, nothing is stored and the first failure is returned.
- Patches may touch any part of the document, including inside a block (`/content/2/content/1/content/0/text`). A patch that changes `/type` or adds a top-level field fails the document check with `invalid_request`.
- After the last operation, the result goes through the same checks as a PUT body, in the same order. Only then is it stored.

### Validation
- PUT checks run in this order, and the first failure is returned: body size (413), `Content-Type` (415), `If-Match` (412), body shape (`invalid_request`), block count (`too_many_blocks`), then each block in order: `type` (`unknown_block_type`), then the node (`invalid_block`).
- PATCH checks run in this order: body size (413), `Content-Type` (415), `If-Match` (428, then 412), operation count (`too_many_operations`), patch shape and application (`invalid_patch`, `patch_test_failed`), then the patched document as for PUT, then its size (`document_too_large`).
- Each block is checked against the schema of its `type` with a JSON Schema draft 2020-12 validator, then against API-003 "Rules beyond the schemas".
- Plain string attributes are trimmed before they are checked and stored, as in API-001. The `text` of rich text `text` nodes is never trimmed: spaces between marked runs matter.
- Attributes left out get their schema `default` before storage, so stored blocks carry every attribute. Responses always show the stored document, defaults included.
- `null` is accepted where a schema allows it (an unset optional attribute) and rejected everywhere else.
- Validation is all or nothing: if any block fails, nothing is stored.
- The stored document is valid against the schema of the block type `version` it was checked with. Rendering trusts it and does not validate again.

### Writes
- PUT is idempotent: the same body twice gives the same stored document and the same response. PATCH is not idempotent in general (an `add` to `/content/-` adds twice), which is what `If-Match` guards against. Neither takes an `Idempotency-Key`.

### Side effects
- A PUT or PATCH that changes the stored document raises `PageChanged { page_id, site_id, change: "blocks" }` through `Hivesite.Content.Contracts`, adding the value `"blocks"` to the `change` field defined in API-002. One that changes nothing raises nothing.

## Open questions
- `GET /pages/{id}/blocks` is not in the plan's endpoint list, but without it an owner cannot read back the blocks they set. Keep it, or return the document from `GET /pages/{id}` instead (a change to API-002)?

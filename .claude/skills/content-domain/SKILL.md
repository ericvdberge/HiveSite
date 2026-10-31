---
name: content-domain
description: What is true in Hivesite's Content module (sites, pages, the menu, block types, page blocks, entities) - limits, ids, error codes, validation order, Tiptap rules, concurrency and events, taken from the approved specs. Use when building, fixing or reviewing code in src/Modules/Content.
---

# Content domain

The specs are the authority; this skill is the short version, so you don't miss a rule that sits in another spec. When this skill and a spec disagree, the spec wins: tell the manager so this file gets fixed.

## Specs

| Spec | What | Status |
|---|---|---|
| API-001 | Sites, and the **shared conventions** every Content spec reuses | built |
| API-002 | Pages and menu order | built |
| API-003 | Block type registry: the seven block schemas and the Tiptap mapping | approved |
| API-004 | Page blocks: one Tiptap document per page, PUT and JSON Patch | approved |
| API-005 | Entities (`page`, `brand_styling`) and the site snapshot | in review: don't build it yet |

Build only from an `approved` spec. Sites (API-001) are the reference code: copy their shape (`src/CLAUDE.md`).

## Shared conventions (API-001)

- **Ids**: UUIDv7 from `Guid.CreateVersion7()`, set in the service. Accepted in any case, returned lowercase. A path id that isn't a UUID is the resource's 404, not a 400.
- **Ownership**: everything is scoped to the signed-in owner (`UserContext`). Another owner's resource is the same 404 as a missing one, never 403.
- **Errors**: `{ "error": { "code", "message", "field"? } }`. `field` is a JSON Pointer into the body (`/content/2/attrs/title`) or a query or header name (`limit`, `If-Match`). Leave `field` out for 401, 404 and count limits. Clients branch on `code`.
- **Status codes**: 400 for anything the client can fix, including checks against stored state (`slug_taken`, `too_many_*`). 412/428 only for `If-Match`, 413 for size, 415 for `Content-Type`.
- **Strict bodies**: unknown fields and wrong types are 400 `invalid_request`. In a POST, `null` on a required field means missing. In a PATCH, `null` means "not sent". The exception is Tiptap documents, where `null` is an unset attribute.
- **Strings**: lengths count Unicode code points after trimming, and the trimmed value is stored (`CodePoints(min, max)`). The `text` of a rich-text `text` node is never trimmed.
- **Lists**: `limit` 1 to 100, default 20; `next_cursor` is the last item's id, or `null` on the last page. A cursor the caller can't list is 400 `invalid_cursor` with `field` `cursor`.
- **Timestamps**: RFC 3339, UTC, second precision, `Z`. Come from `ITimeService`.
- **No-op writes**: a PATCH or PUT whose result equals what's stored writes nothing: same `updated_at`, same `ETag`, no event.
- **Not in this version**: idempotency keys, locks on count limits, signed cursors, delete for sites.

## Limits

| What | Limit | Error |
|---|---|---|
| Sites per owner | 10 | `too_many_sites` |
| Site `name` / page `title` | 1 to 80 | `invalid_request` |
| Site `slug` | 3 to 40, unique across **all** owners | `slug_taken` |
| Page `slug` | 1 to 60, unique **within the site**; `assets` is reserved | `slug_taken`, `slug_reserved` |
| Slug pattern | `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` | `invalid_request` |
| `settings.description` | 0 to 160 | `invalid_request` |
| `settings.language` | 2 to 35, `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`, default `en` | `invalid_request` |
| Pages per site, menu `page_ids` | 50 | `too_many_pages` |
| Blocks per page | 0 to 40 | `too_many_blocks` |
| PUT/PATCH body | 256 KB (262,144 bytes), checked before parsing | 413 `request_too_large` |
| Stored blocks document | 256 KB as compact UTF-8 JSON | `document_too_large` |
| Operations per JSON Patch | 200 | `too_many_operations` |
| Rich text per `rich_text` block | 10,000 code points of text, 200 top-level nodes, lists 3 levels deep | `invalid_block` |

The limits for each block's attributes are in the API-003 schemas.

## Pages and menu (API-002)

- The pages of a site always have `menu_order` 0, 1, 2, … with no gaps. A new page goes at the end. A delete moves the pages after it up by one.
- `menu_order` 0 is the home page. A site doesn't name its home page.
- `menu_order` changes only through `PUT /sites/{id}/menu`, which lists every page exactly once: otherwise `menu_mismatch` and nothing changes. A duplicate id is `invalid_request`. Sending `menu_order` in `PATCH /pages/{id}` is `invalid_request`.
- A menu change does not touch the pages' `updated_at`. Deleting a page deletes its blocks.

## Blocks (API-003, API-004)

- **Exactly seven types**, fixed in code: `hero`, `rich_text`, `image`, `gallery`, `card_list`, `contact_form`, `embed`. Each has `version` 1. The key is the Tiptap node name and never changes.
- **A page's blocks are one Tiptap document**: `{ "type": "doc", "content": [ … ] }`. Blocks have no id; they're known by their position, which `If-Match` keeps safe.
- **Stored blocks carry every attribute.** Fill each left-out attribute with its schema `default` at every depth (inside the matched `oneOf` branch and inside array items), then store. Responses show the stored document.
- **Validation** uses a JSON Schema 2020-12 validator with the API-003 schemas, then the "Rules beyond the schemas": a `https://` URL must have a host, form field names are unique, embed hosts match the provider, the 10,000-code-point text total, list nesting depth, a `listItem` starts with a `paragraph`, and each mark appears at most once. A failure is `invalid_block` with `field` set to the failing value's pointer.
- **Rich text is Tiptap JSON**, never HTML or Markdown: nodes `paragraph`, `heading` (levels 2 and 3), `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text`; marks `bold`, `italic`, `link`. Tiptap's camelCase names stay as they are; our own names are `snake_case`.
- **Link attributes**: `target`, `rel` and `class` on a link mark (and `type` on `orderedList`) are accepted and stored as sent; Rendering ignores them.
- **PUT check order** (return the first failure): 413, 415, 412, body shape (`invalid_request`), `too_many_blocks`, then each block in order: `unknown_block_type`, then `invalid_block`.
- **PATCH check order**: 413, 415, 428 then 412, `too_many_operations`, `invalid_patch` or `patch_test_failed`, then the patched document exactly as for PUT, then `document_too_large`. The operations run on a copy; if one fails, nothing is stored.
- **Concurrency**: the `ETag` is the document's version integer in quotes (a strong ETag). It's `"1"` for a new page and goes up by 1 on every change. PATCH requires `If-Match`; PUT takes it optionally (no `If-Match` means last write wins). `*` or more than one value is `invalid_request`. The check and the write happen in one transaction.
- **`card_list` with `source.kind` `collection`** stores only the binding. The cards are looked up at render time. In version 1 `entity_type` is only `page`: the site's other pages.

## Events (`Hivesite.Content.Contracts`)

Raise them from the service, after the write succeeded, and never for a no-op.

- `SiteChanged { site_id, change: created | updated }`
- `PageChanged { page_id, site_id, change: created | updated | deleted | blocks }`
- `MenuChanged { site_id, page_ids }`: on a menu PUT that changes the order, and after a page POST or DELETE.

## Module boundaries

- Content owns schema `content` and `ContentDbContext`. No other module reads them; they ask through `Hivesite.Content.Contracts`.
- Content does not know about releases, themes or rendering. A site's theme is not a site field: it becomes the `brand_styling` entity once API-005 is approved.
- Other modules trust what Content stored and don't validate it again, so validation here has to be complete.

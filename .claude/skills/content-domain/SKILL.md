---
name: content-domain
description: Where the Content module's rules live and the ones that are easy to miss because they sit in another spec. Use when building, fixing or reviewing code in src/Modules/Content.
---

# Content domain

The specs hold the rules; this skill doesn't repeat them. Read your story's spec in full, then check this list.

## Where the rules are
- **API-001 Shared conventions**: auth, ids, errors, strict bodies, lists and timestamps for every Content spec, not only for sites.
- **API-003**: block schemas, the Tiptap mapping and "Rules beyond the schemas".
- **API-004**: the blocks document, check order, `ETag` and JSON Patch.
- **API-005 (entities)** is in review. Don't build it until it's approved.

## Easy to miss
- In a POST, `null` on a required field means missing. In a PATCH, `null` means "not sent". In a Tiptap document, `null` means an unset attribute.
- Trim plain strings, but never the `text` of a rich-text `text` node.
- Store every block attribute: fill each `default` at every depth, including inside `oneOf` branches and array items.
- A no-op write changes nothing: same `ETag`, same `updated_at`, no event.
- A menu change doesn't touch the pages' `updated_at`. A blocks change does.
- Other modules trust what Content stores and never validate it again, so validation here has to be complete.

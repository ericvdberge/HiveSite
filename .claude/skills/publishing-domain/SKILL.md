---
name: publishing-domain
description: What is true in Hivesite's Publishing module (releases, history, rollback, serving the live site) - immutability, the live pointer, rollback and retry rules, retention and limits, events, plus which specs are still open. Use when building, fixing or reviewing code in src/Modules/Publishing.
---

# Publishing domain

The specs are the authority; this skill is the short version. When this skill and a spec disagree, the spec wins: tell the manager so this file gets fixed.

## Specs: none approved yet

| Spec | What | Status |
|---|---|---|
| API-020 | Releases and rollback | in review |
| API-021 | Serving the live site | draft, held for ADR 3 |
| ADR 3 | Builds become sandboxed and asynchronous; one origin per site | proposed |

Build nothing that isn't in an approved spec. ADR 3 may change four things: the build call (`RenderSite` or a template build), whether publish stays synchronous (it may become 202 with a `building` state), what identifies a release's look (`theme` and `theme_version` or a template version), and path-based serving under `/s/{site_slug}/` (one origin per site). Check where those stand before you start.

## Releases

- **Immutable.** A release never changes after it's created, and its files are never rewritten.
- **`number`** is 1, 2, 3, … per site, never reused, also after pruning. Make it unique per site: if two publishes race, one is stored and the other fails.
- **Every publish creates a release**, even when nothing changed. There's no `Idempotency-Key`.
- **One consistent read.** Publish reads the site, its `brand_styling`, its pages in `menu_order` and their blocks in one read through `Hivesite.Content.Contracts`. Never read Content's tables.
- **Files first.** Store every file (in a local `releases/` folder, git-ignored; blob storage later) before the release goes live. If storing fails, no release is created and the live release doesn't change.
- **The release records its home page's slug** (`menu_order` 0) internally, for redirects.
- **The live pointer moves in one database write**, so a visitor gets the old release or the new one, never a mix.
- Every field is always present. Only `live_since` can be `null`.

## Rollback

- Rollback moves the live pointer to a release that's kept. It creates no release and never changes `number`.
- It changes only what visitors see: pages, blocks and `brand_styling` stay as they are, and nothing is deleted.
- Rolling back to the release that's already live is a no-op: 200 with the release as it is, and no event. Rolling back twice gives the same result.
- After a rollback, the next publish builds the current draft as a new release with the next `number`.

## Limits and retention

| What | Limit | Error |
|---|---|---|
| Files per release | 3,000 | `release_too_large` |
| Size per release | 50 MB (52,428,800 bytes) | `release_too_large` |
| `note` | 0 to 200 characters after trimming | `invalid_request` |
| Kept releases | the 20 newest, plus the live one if it's older | pruned ones return 404 `release_not_found` |

- Prune after a publish, deleting each pruned release's files and its record. Never prune the live release.
- A site with no pages can't be published: `site_has_no_pages`.

## Slugs and serving

- Release HTML uses relative links, so a release works under any slug and a slug change goes live without a new publish.
- Listen to `SiteChanged` (API-001) and record each slug a published site has had and when it stopped being current, so former slugs can redirect.
- The page slug `assets` is reserved in Content (API-002) for files Publishing serves.
- The home page (`menu_order` 0) is served at the site root.

## Events and contracts (`Hivesite.Publishing.Contracts`)

- `ReleasePublished { site_id, release_id, number, reason: publish | rollback }`, raised after the live pointer moves. A no-op rollback raises nothing.
- `GetLiveRelease(site_id)` is offered to other modules.
- Operation names `PublishSite`, `ListReleases`, `GetRelease` and `RollbackRelease` are the `operationId`s and the C# method names. They never change.

## Module boundaries

- Release metadata lives in its own `DbContext`, schema `publishing` (ADR 2).
- Read content only through `Hivesite.Content.Contracts`, and rendered output or build results only through `Hivesite.Rendering.Contracts`. Never do the rendering here, and never reach into another module's project.
- Not in this version: unpublish, previewing an old release, idempotency keys, serializing publishes per site.

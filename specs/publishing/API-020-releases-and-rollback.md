---
id: API-020
title: Releases and rollback
domain: publishing
status: in review
owner: api-architect
stories: [19, 20]
depends_on: [API-001, API-002, API-004, API-010, API-011]
version: 2
---

## Purpose
A site owner can publish a site as an immutable release, see the release history, and make an older release live again.

Auth, ids, errors, validation, lists and timestamps follow the shared conventions in API-001. The build is API-011 v2 `RenderSite`; the theme is `settings.theme` (API-001 v4, API-010 v2). Those three versions are in spec PR #132, not yet merged; this spec depends on them as written there.

Version 2 follows ADR 4. A release is the files of the default Vue template, built in-process by Rendering, stored in a local folder and served on the API origin under `/s/{site_slug}/` (API-021). The `brand_styling` entity, former-slug redirects, the home page slug and the `ReleasePublished` event of version 1 are gone, and so are its ADR 3 open questions.

## Endpoints

### POST /sites/{id}/publish
Auth: site owner

Operation: `PublishSite`

Builds the site as it is now, stores the files as a new release and makes it live. The call returns when the release is live.

Request
```json
{
  "note": "New spring collection"
}
```

The body is optional. Without a body, or with `{}`, `note` is `""`.

Response 201

Headers: `Location: /releases/01a1828f-3c10-7d2e-8b4f-0e2a6c9d1b57`
```json
{
  "id": "01a1828f-3c10-7d2e-8b4f-0e2a6c9d1b57",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "number": 3,
  "note": "New spring collection",
  "is_live": true,
  "theme": "atelier",
  "theme_version": 1,
  "site_slug": "atelier-noor",
  "page_count": 3,
  "file_count": 11,
  "size_bytes": 412377,
  "created_at": "2026-10-28T14:02:11Z",
  "live_since": "2026-10-28T14:02:11Z"
}
```

Errors
- 400 `invalid_request`: the body is not JSON, `note` is not a string or is over 200 characters, or an unknown field is present. `field` is `/note` when `note` is to blame.
- 400 `no_pages`: the site has no pages, so there is no home page to publish. From `RenderSite`.
- 400 `build_too_large`: the built site has more than 3,000 files or more than 50 MB. From `RenderSite`. Nothing is stored.
- 401 `unauthenticated`
- 404 `site_not_found`: as in API-001.
- 415 `unsupported_media_type`: a body is sent and `Content-Type` is not `application/json`.
- 500 `build_failed`: the build did not finish (API-011 Build contract). From `RenderSite`. Nothing is stored and the live release does not change. This is a Hivesite bug, never a content problem.
- 500 `internal_error`: writing the files failed. Nothing is recorded and the live release does not change.

`no_pages` and `build_too_large` cannot be fixed by sending the request again: the draft must change first.

### GET /sites/{id}/releases
Auth: site owner

Operation: `ListReleases`

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/releases?limit=2
```

Response 200
```json
{
  "items": [
    {
      "id": "01a1828f-3c10-7d2e-8b4f-0e2a6c9d1b57",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "number": 3,
      "note": "New spring collection",
      "is_live": false,
      "theme": "atelier",
      "theme_version": 1,
      "site_slug": "atelier-noor",
      "page_count": 3,
      "file_count": 11,
      "size_bytes": 412377,
      "created_at": "2026-10-28T14:02:11Z",
      "live_since": null
    },
    {
      "id": "01a18270-91ab-7f04-a6d3-55e1b0c7f284",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "number": 2,
      "note": "",
      "is_live": true,
      "theme": "ivory",
      "theme_version": 1,
      "site_slug": "atelier-noor",
      "page_count": 3,
      "file_count": 11,
      "size_bytes": 398105,
      "created_at": "2026-10-28T13:28:40Z",
      "live_since": "2026-10-28T14:20:03Z"
    }
  ],
  "next_cursor": "01a18270-91ab-7f04-a6d3-55e1b0c7f284"
}
```

Here release 2 was made live again by a rollback after release 3 was published. A site that has never published returns `{ "items": [], "next_cursor": null }`.

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit`.
- 400 `invalid_cursor`: `cursor` is not the id of a kept release of this site. `field` is `cursor`.
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /releases/{id}
Auth: site owner

Operation: `GetRelease`

Request
```
GET /releases/01a18270-91ab-7f04-a6d3-55e1b0c7f284
```

Response 200
```json
{
  "id": "01a18270-91ab-7f04-a6d3-55e1b0c7f284",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "number": 2,
  "note": "",
  "is_live": true,
  "theme": "ivory",
  "theme_version": 1,
  "site_slug": "atelier-noor",
  "page_count": 3,
  "file_count": 11,
  "size_bytes": 398105,
  "created_at": "2026-10-28T13:28:40Z",
  "live_since": "2026-10-28T14:20:03Z"
}
```

Errors
- 401 `unauthenticated`
- 404 `release_not_found`: no release with this id, it was pruned (see Retention), or its site belongs to another owner.

### POST /sites/{id}/releases/{rid}/rollback
Auth: site owner

Operation: `RollbackRelease`

Makes another kept release of the site live: an older one, or a newer one to undo an earlier rollback. Nothing is built: the release's stored files are served as they are, with the theme and content they were published with.

Request
```
POST /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/releases/01a18270-91ab-7f04-a6d3-55e1b0c7f284/rollback
```

No body. An empty body or `{}` is accepted.

Response 200
```json
{
  "id": "01a18270-91ab-7f04-a6d3-55e1b0c7f284",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "number": 2,
  "note": "",
  "is_live": true,
  "theme": "ivory",
  "theme_version": 1,
  "site_slug": "atelier-noor",
  "page_count": 3,
  "file_count": 11,
  "size_bytes": 398105,
  "created_at": "2026-10-28T13:28:40Z",
  "live_since": "2026-10-28T14:20:03Z"
}
```

Errors
- 400 `invalid_request`: a body is sent that is not empty and not `{}`.
- 401 `unauthenticated`
- 404 `site_not_found`
- 404 `release_not_found`: no release with this id for this site, or it was pruned.

## Rules

### Release fields
- `id`: a UUIDv7, as API-001 Ids. Set by the server.
- `site_id`: the site the release belongs to.
- `number`: 1, 2, 3, … per site, in the order releases are created. Unique per site and never reused, also after pruning. Owners speak of "release 3".
- `note`: 0 to 200 characters after trimming, default `""`. Set on publish, never changed.
- `is_live`: `true` for exactly one release of a site once it has published, `false` for all others.
- `theme`: `site.settings.theme` in the snapshot the release was built from. `theme_version`: that theme's `version` from `ListThemes` in `Hivesite.Rendering.Contracts` (API-010).
- `site_slug`: the site slug when the release was created. For information only: the live site is always served under the current slug (API-021).
- `page_count`: the number of pages in the snapshot. `file_count` and `size_bytes`: the number of files `RenderSite` returned and the sum of their byte lengths.
- `created_at`: when the release was created. `live_since`: when it last became live, or `null` when it is not live.
- Every field is always present. Only `live_since` can be `null`.

### Publishing
1. Publish calls `GetSiteSnapshot(site_id)` on `Hivesite.Content.Contracts` (API-011 Snapshot). `null` is 404 `site_not_found`.
2. It calls `RenderSite(snapshot)` on `Hivesite.Rendering.Contracts` (API-011 Build contract), exactly once, and takes its files as they are. Its `no_pages`, `build_too_large` and `build_failed` are returned with the same `code`, as in Endpoints. Publishing does not check the files again: Rendering enforces the limits.
3. It writes every file to the release folder (see Storage).
4. In one database transaction it inserts the release with the next `number` and points the site's live pointer at it.
5. It prunes old releases (see Retention).

- If step 2 or 3 fails, no release is recorded, the live release does not change, and any files already written for it are deleted.
- A release never changes after it is created. Its files are never rewritten.
- Every publish creates a new release, also when nothing changed since the last one.
- Publish is synchronous. A release build is killed after 30 seconds (API-011 Limits), which fits in one request.

### Storage
- Release files are stored on the local disk of the Host, under a root folder from configuration: `Publishing:ReleasesPath`, default `releases` relative to the Host's content root (git-ignored). Blob storage is a later story.
- Each release has its own folder, `{ReleasesPath}/{site_id}/{release_id}/`. A file's `path` from `RenderSite` maps to a file in it:

  | `path` | Stored as |
  |---|---|
  | `/` | `index.html` |
  | `/{page_slug}` | `{page_slug}/index.html` |
  | `/404.html` | `404.html` |
  | `/assets/{file}` | `assets/{file}` |

  Page slugs match the slug pattern of API-001 and `assets` is reserved (API-002), so no two paths map to the same file.
- The release record keeps the list of its files: `path`, `content_type` and byte length of each, as `RenderSite` returned them. API-021 serves from this list.

### Live pointer
- Each site that has published has one live pointer: the id of its live release. It is a row in the `publishing` schema, read by API-021 on every request.
- Publish and rollback change it with one database write, so a visitor gets either the old release or the new one, never a mix.

### Rollback
- Rollback moves the live pointer to an existing release and sets that release's `live_since` to now. It creates no release and does not change `number`.
- Any kept release can be made live, older or newer than the live one. A rollback is undone by a rollback to the release that was live before it.
- Rollback changes only what visitors see. It does not change the draft: pages, blocks and `settings.theme` stay as they are. It deletes nothing.
- Rolling back to the release that is already live changes nothing and returns 200 with the release as it is.
- After a rollback, the next publish builds the current draft as a new release with the next `number` and makes it live.

### Ownership
- `ListReleases` and `RollbackRelease` call `GetSiteSummary(site_id)` on `Hivesite.Content.Contracts`; `GetRelease` calls it with the release's `site_id`. `null` is 404 `site_not_found`, or 404 `release_not_found` for `GetRelease`.

### Ordering
- `GET /sites/{id}/releases` returns releases by `number` descending, newest first.

### Retention
- A site keeps its 10 newest releases plus the live release. After a publish, older releases beyond that are pruned: their folder and their record are deleted, and they return 404 `release_not_found`.
- The live release is never pruned, also when it is older than the 10 newest.
- A file that cannot be deleted is logged and left; the record is deleted anyway.

### Limits
- Max 3,000 files and 50 MB (52,428,800 bytes) per release, enforced by `RenderSite` (API-011 Limits). Larger returns 400 `build_too_large`.
- `note`: max 200 characters.
- Max 11 kept releases per site (10 newest plus a live one older than those), so at most 550 MB per site on disk.

### Contracts
Publishing needs two small operations that Content adds to `IContentApi` in `Hivesite.Content.Contracts`, next to API-011's `GetSiteSnapshot`. Content builds them:
- `GetSiteSummary(site_id)` → `SiteSummary { Id, Slug }`, or `null` when the site does not exist or belongs to another owner. Used here for ownership.
- `GetSiteIdBySlug(slug)` → the id of the site whose current slug is exactly `slug`, or `null`. No owner check: it serves public requests (API-021).

Publishing offers nothing to other modules in this version.

### Side effects
- Publish and rollback raise no events in this version. No module needs one.

### Operation names
- `PublishSite`, `ListReleases`, `GetRelease`, `RollbackRelease` (HTTP), and `GetSiteSummary`, `GetSiteIdBySlug` (Content contract). Each becomes the `operationId` and the C# method name, and is the name a tool call uses. Renaming one is a breaking change.

## Agent use
An AI agent acting for an owner, through tool calls or an MCP server, can publish, check and roll back a site with this spec alone. This section adds no behaviour.

| Operation | Changes | Safe to repeat | Check the result with |
|---|---|---|---|
| `PublishSite` | Creates a release and makes it live. May prune the oldest release (see Retention). | No: every call creates a new release. | `is_live` and `number` in the response, or `ListReleases`. |
| `ListReleases`, `GetRelease` | Nothing. | Yes. | – |
| `RollbackRelease` | Moves the live pointer. Deletes nothing and leaves the draft as it is. | Yes: the same call again changes nothing. | `is_live` and `live_since` in the response, or `GetRelease`. |

- Before `PublishSite`, an agent notes the newest `number` from `ListReleases` with `limit=1`. After a timeout or a lost response it calls that again: if the newest release has a higher `number` and is live, the publish went through and it does not publish again.
- To undo a publish, an agent rolls back to the release that was live before it, found in `ListReleases` before it published.
- An agent branches on `code`. `no_pages` and `build_too_large` mean the draft must change first. `build_failed` may be retried once; a second failure is a bug to report.
- A publish is a public change. An agent asks the owner before it calls `PublishSite` or `RollbackRelease`, unless the owner told it to go ahead.

## Decisions
- **The build is API-011 v2 `RenderSite`, called once per publish,** with the snapshot from Content's `GetSiteSnapshot`. Publishing receives files and stores them; it does not know how they were built (ADR 4).
- **Rendering's error codes are passed through unchanged:** `no_pages`, `build_too_large`, `build_failed`. One name per failure across both specs. This replaces version 1's `site_has_no_pages` and `release_too_large`.
- **Files go to a local folder from configuration,** one folder per release, with `index.html` for `/` and each page, as the plan says ("local folder now, blob storage later"). The file list with content types is kept with the release, so serving never builds a disk path from a request.
- **Rollback moves a pointer, it does not copy.** "Release 2 is live again" is clearer than a new release 4 that equals release 2.
- **Retention is 10 releases plus the live one,** so local disk per site stays at most 550 MB.
- **`theme` and `theme_version` stay on a release,** so the history shows the look each release was built with (API-010 v2).
- **Two Content operations, `GetSiteSummary` and `GetSiteIdBySlug`,** because Publishing must check ownership and serve by slug without reading Content's data (ADR 1). They need a Content build next to API-011's `GetSiteSnapshot`.
- **Publish is synchronous.** The 30-second build limit fits in one request.
- **Not in this version:** the `ReleasePublished` event and a `GetLiveRelease` contract (no consumer yet), unpublish, a preview of an old release, blob storage, an `Idempotency-Key` on publish, a lock that serializes publishes and rollbacks of one site (two racing publishes: `number` is unique per site, so one is stored and the other returns 500 `internal_error`), a job queue with a status to poll, and brand styling from the `brand_styling` entity (API-005, ADR 3).

## Open questions
- none

---
id: API-020
title: Releases and rollback
domain: publishing
status: in review
owner: api-architect
stories: [19, 20]
depends_on: [API-001, API-002, API-004, API-010, API-011]
version: 1
---

## Purpose
A site owner can publish a site as an immutable release, see the release history, and make an older release live again.

Auth, ids, errors, validation, lists, idempotency and timestamps follow the shared conventions in API-001.

## Endpoints

### POST /sites/{id}/publish
Auth: site owner

Headers: `Idempotency-Key` (optional, see API-001 Idempotency)

Renders the site as it is now (API-011 `RenderSite`, `mode` `release`, with the site's current brand styling; brand styling comes from the `brand_styling` entity, API-005), stores the files as a new release and makes it live. The call returns when the release is live.

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
  "file_count": 9,
  "size_bytes": 412377,
  "created_at": "2026-10-28T14:02:11Z",
  "live_since": "2026-10-28T14:02:11Z"
}
```

Errors
- 400 `invalid_request`: body is not JSON, `note` is not a string or is over 200 characters, or an unknown field is present.
- 400 `site_has_no_pages`: the site has no pages, so there is no home page to publish.
- 400 `release_too_large`: the rendered site has more than 3,000 files or more than 50 MB in total. Nothing is stored.
- 400 `idempotency_key_reused`
- 401 `unauthenticated`
- 404 `site_not_found`
- 415 `unsupported_media_type`: a body is sent and `Content-Type` is not `application/json`.

### GET /sites/{id}/releases
Auth: site owner

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
      "file_count": 9,
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
      "file_count": 9,
      "size_bytes": 398105,
      "created_at": "2026-10-28T13:28:40Z",
      "live_since": "2026-10-28T14:20:03Z"
    }
  ],
  "next_cursor": "c_eyJuIjoyfQ"
}
```

Here release 2 was made live again by a rollback after release 3 was published.

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /releases/{id}
Auth: site owner

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
  "file_count": 9,
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

Makes an older release live again. Nothing is rendered: the release's stored files are served as they are, with the theme and content they were published with.

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
  "file_count": 9,
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
- `number`: 1, 2, 3, … per site, in the order releases are created. Never reused, also after pruning. Owners speak of "release 3".
- `note`: 0 to 200 characters after trimming, default `""`. Set on publish, never changed.
- `is_live`: `true` for exactly one release of a site once it has published, `false` for all others.
- `theme`, `theme_version`: the theme key (the `theme` field of the `brand_styling` entity, API-005) and theme version (API-010) the release was rendered with.
- `site_slug`: the site slug when the release was created. For information only; the live site is always served under the current slug (API-021).
- `page_count`: the number of pages in the release. `file_count` and `size_bytes`: the stored files and their total size in bytes.
- `created_at`: when the release was created. `live_since`: when it last became live, or `null` when it is not live.
- Every field is always present. Only `live_since` can be `null`.

### Publishing
- Publish reads the site, its `brand_styling` entity (API-005), its pages in `menu_order` and their blocks in one consistent read through `Hivesite.Content.Contracts`. It then calls `RenderSite` (API-011), and takes `theme_version` from the theme registry in `Hivesite.Rendering.Contracts` (API-010).
- The release holds exactly the files `RenderSite` returned, under their paths. They are written to file storage (a local folder now, blob storage later) before the release is made live. If storing fails, no release is created and the live release does not change.
- The release also records, internally, the slug of its home page (`menu_order` 0), so API-021 can redirect `/s/{site_slug}/{home_slug}` to the site root.
- A release never changes after it is created. Its files are never rewritten.
- Every publish creates a new release, also when nothing changed since the last one.
- With an `Idempotency-Key`, a repeat with the same key and body returns the first response (201 and the same release) without rendering again, as API-001 Idempotency says.
- Publish is synchronous. With the limits below it renders in well under the Host's request timeout.

### Rollback
- Rollback moves the live pointer to an existing release. It creates no release and does not change `number`.
- Rolling back to the release that is already live changes nothing and returns 200 with the release as it is.
- After a rollback, the next publish renders the current draft as a new release with the next `number` and makes it live.
- Rollback is idempotent and takes no `Idempotency-Key`.

### Concurrency
- Publishes and rollbacks of one site run one at a time, in the order they arrive. Each sees the result of the one before. Different sites do not wait for each other.
- Making a release live is one database write. A visitor gets either the old release or the new one, never a mix (API-021).

### Ordering
- `GET /sites/{id}/releases` returns releases by `number` descending, newest first.

### Retention
- A site keeps its 20 newest releases plus the live release. After a publish, older releases beyond that are pruned: their files and their record are deleted, and they return 404 `release_not_found`.
- The live release is never pruned, also when it is older than the 20 newest.

### Limits
- Max 3,000 files and 50 MB (52,428,800 bytes) per release. Larger returns 400 `release_too_large`.
- `note`: max 200 characters.
- Max 21 stored releases per site (20 newest plus a live one older than those).

### Site slug changes
- Release HTML has relative links (API-011), so it works under any slug. A slug change in Content reaches the live site at once, without a new publish.
- Publishing listens to `SiteChanged` (API-001) and records each slug a published site has had, with the time it stopped being current. API-021 uses this to redirect former slugs.

### Side effects
- Raised through `Hivesite.Publishing.Contracts` after the live pointer changes:
  - `ReleasePublished { site_id, release_id, number, reason: "publish" | "rollback" }`.
- A rollback to the release that is already live raises nothing.
- `Hivesite.Publishing.Contracts` also offers `GetLiveRelease(site_id)` for other modules. Content does not use it in this version.

## Decisions
- **Rollback moves a pointer, it does not copy.** Release numbers stay the owner's history: "release 2 is live again" is clearer than a new release 4 that equals release 2.
- **`GET /releases/{id}` is added** to the plan's endpoint list, for the `Location` header and for reading one release.
- **Publish always creates a release.** Skipping unchanged content would make a publish with a new `note` do nothing, which is surprising.
- **There is no unpublish** in this version. A site that has published stays online with its live release. Unpublishing is a later story.
- **There is no preview of an old release** in this version. The owner sees its number, note, theme and dates in the history.
- **Publish is synchronous.** A job queue with a status to poll is a later story, when a site can be big enough to need it.
- **Retention is 20 releases** so storage per site stays bounded (at most 21 × 50 MB).

## Open questions
- ADR 3: how is a release built? This spec calls the C# `RenderSite` (API-011), which is held. Under ADR 3 a release is a static build of Vue/Nuxt templates in a sandbox. Which contract does Publishing call, and what does it get back: files with paths and content types, as now?
- ADR 3: is publish still synchronous? A sandboxed build may take longer than the Host's request timeout. If not, publish returns 202 with a release in a `building` state, and this spec needs that state, a failure state and a way to poll.
- ADR 3: do the limits hold for a static build (max 3,000 files and 50 MB per release)? A Nuxt build adds framework files per release.
- ADR 3: `theme` and `theme_version` on a release. If templates replace the theme registry (API-010), what identifies the look a release was built with: theme key and version, a template version, or both?
- ADR 3: Site slug changes and the home page slug. Both exist for path-based `/s/{site_slug}/` serving (API-021, held). With a per-site origin, does a slug change still reach the live site without a republish, and does a release still record its home page slug?
---
id: API-006
title: Site assets
domain: content
status: in review
owner: api-architect
stories: [92]
depends_on: [API-001]
version: 1
---

## Purpose
A site owner can upload an image to their site's library, list the library, and read an image's metadata and bytes; Publishing can read the same through `Hivesite.Content.Contracts`.

Auth, ids, errors, lists, timestamps and status codes follow the shared conventions in API-001. This version stores one original per asset: no variants, no delete, no use in blocks yet.

## Endpoints

### POST /sites/{id}/assets
Auth: site owner

Headers: `Content-Type: multipart/form-data; boundary=…`

The body has exactly one part: a file part named `file`. The part's own `Content-Type` and the file name's extension are ignored; the type is read from the bytes (see Accepted images).

Request
```
POST /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/assets
Content-Type: multipart/form-data; boundary=hs-7f3a

--hs-7f3a
Content-Disposition: form-data; name="file"; filename="Vaas blauw.JPG"
Content-Type: image/jpeg

<2,481,377 bytes of JPEG>
--hs-7f3a--
```

Response 201

Headers: `Location: /assets/01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42`
```json
{
  "id": "01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "filename": "Vaas blauw.JPG",
  "content_type": "image/jpeg",
  "size_bytes": 2481377,
  "width": 3024,
  "height": 4032,
  "content_hash": "9f2c4e81b07a3d5c6e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d",
  "created_at": "2026-11-01T10:12:44Z"
}
```

Response 400 (not an accepted image)

An SVG file renamed `logo.png`:
```json
{
  "error": {
    "code": "unsupported_image_type",
    "message": "The file is not a JPEG, PNG or WebP image.",
    "field": "file"
  }
}
```

Errors
- 400 `invalid_request`: the body has no part named `file`, a part other than `file`, more than one part, or `file` is not a file part. `field` is `file`.
- 400 `unsupported_image_type`: the bytes are not a JPEG, PNG or WebP, or the image is animated (see Accepted images). `field` is `file`.
- 400 `invalid_image`: the file is empty, larger than 10 MB, over a dimension or pixel limit, or truncated or malformed so it does not decode. `field` is `file`; the message names the problem.
- 401 `unauthenticated`
- 404 `site_not_found`: as in API-001, the same for a missing site, another owner's site and an id that is not a UUID.
- 413 `request_too_large`: the request body is larger than 10,551,296 bytes (10 MB plus 64 KB for the multipart framing).
- 415 `unsupported_media_type`: `Content-Type` is not `multipart/form-data`.

Nothing is stored when any error is returned.

### GET /sites/{id}/assets
Auth: site owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/assets?limit=2
```

Response 200
```json
{
  "items": [
    {
      "id": "01a1823f-91b0-7a55-9c12-7e4d3b8a6c05",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "filename": "atelier-light.webp",
      "content_type": "image/webp",
      "size_bytes": 412908,
      "width": 2400,
      "height": 1600,
      "content_hash": "3b7d1e0f9a8c6b5d4e2f1a0c9b8d7e6f5a4c3b2d1e0f9a8b7c6d5e4f3a2b1c0d",
      "created_at": "2026-11-01T10:15:02Z"
    },
    {
      "id": "01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "filename": "Vaas blauw.JPG",
      "content_type": "image/jpeg",
      "size_bytes": 2481377,
      "width": 3024,
      "height": 4032,
      "content_hash": "9f2c4e81b07a3d5c6e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d",
      "created_at": "2026-11-01T10:12:44Z"
    }
  ],
  "next_cursor": "01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42"
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit` when the number is out of range; a value that is not a number returns the error without `field`, as API-001.
- 400 `invalid_cursor`: `cursor` is not the id of an asset of this site. `field` is `cursor`.
- 401 `unauthenticated`
- 404 `site_not_found`

### GET /assets/{id}
Auth: site owner

Request
```
GET /assets/01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42
```

Response 200
```json
{
  "id": "01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "filename": "Vaas blauw.JPG",
  "content_type": "image/jpeg",
  "size_bytes": 2481377,
  "width": 3024,
  "height": 4032,
  "content_hash": "9f2c4e81b07a3d5c6e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d",
  "created_at": "2026-11-01T10:12:44Z"
}
```

Errors
- 401 `unauthenticated`
- 404 `asset_not_found`: no asset with this id, its site belongs to another owner, or the id is not a UUID. The same response for all three.

### GET /assets/{id}/content
Auth: site owner

The original bytes, exactly as uploaded, so the studio can show the image.

Request
```
GET /assets/01a1823e-4c1a-7d2e-8b3f-2a6c9e0d1f42/content
```

Response 200

Headers:
```
Content-Type: image/jpeg
Content-Length: 2481377
Content-Disposition: inline
X-Content-Type-Options: nosniff
```

Body: the 2,481,377 stored bytes.

Errors
- 401 `unauthenticated`
- 404 `asset_not_found`: as for `GET /assets/{id}`. Errors are JSON in the `specs/STYLE.md` shape.

## Rules

### Asset fields
- `id`: a UUIDv7 as API-001, set by the server, never changes.
- `site_id`: the site whose library holds the asset. Never changes; assets do not move between sites.
- `filename`: the display name, cleaned as in File names. Never used to store or find the file.
- `content_type`: `image/jpeg`, `image/png` or `image/webp`, from the detected format, never from the request.
- `size_bytes`: the length of the stored original in bytes, 1 to 10,485,760.
- `width`, `height`: in pixels, as the image is displayed. When the image has an EXIF orientation of 5 to 8 (rotated by 90 or 270 degrees), the encoded width and height are swapped. The stored bytes are not changed.
- `content_hash`: the SHA-256 of the stored bytes, 64 lowercase hex digits.
- `created_at`: as API-001.
- Every field is always present. No field is ever `null`. An asset never changes after upload in this version.

### Accepted images
The format is detected from the first bytes of the file:

| Format | Signature | `content_type` | Stored extension |
|---|---|---|---|
| JPEG | `FF D8 FF` | `image/jpeg` | `jpg` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` | `image/png` | `png` |
| WebP | `RIFF`, 4 bytes, then `WEBP` | `image/webp` | `webp` |

- Anything else returns 400 `unsupported_image_type`, whatever its name or `Content-Type` says: SVG, GIF, AVIF, HEIC, HTML, PDF.
- Animated images (an APNG, or a WebP with more than one frame) return 400 `unsupported_image_type`.
- Content then decodes the whole image with the image library. A file that fails to decode, is truncated, or whose header disagrees with its data returns 400 `invalid_image`.

### Limits
- File: 1 to 10,485,760 bytes (10 MB). Empty or larger returns 400 `invalid_image`.
- Request body: max 10,551,296 bytes. Larger returns 413 `request_too_large` before the body is parsed.
- Width and height: each 1 to 12,000 px. Width × height: max 40,000,000 pixels. Both are read from the image header before decoding, so a decompression bomb is rejected with 400 `invalid_image` without being decoded.
- No limit on the number of assets or total storage per site in this version (see Decisions).

### File names
The display `filename` is made from the part's `filename` (or `filename*`, which wins when both are sent):
1. Keep only the text after the last `/` or `\`.
2. Remove control characters (Unicode category Cc) and format characters (Cf, for example the right-to-left override U+202E).
3. Trim whitespace and cut to 120 code points.
4. If nothing is left, use `image.` plus the stored extension, for example `image.jpg`.

Example: `../../uploads/Vaas blauw.JPG` becomes `Vaas blauw.JPG`.

### Storage
- Bytes go to file storage behind an interface in Content: a local folder now, blob storage later, as release files in API-020. The root is configuration.
- The storage key is `{site_id}/{asset_id}.{ext}`, with `ext` from Accepted images. Nothing from the request is part of it.
- The original is stored byte for byte. Nothing is stripped, re-encoded or rotated.
- Metadata is a row of `content.assets`: `id uuid` primary key, `site_id uuid` not null with a foreign key to `content.sites`, `filename text`, `content_type text`, `size_bytes bigint`, `width integer`, `height integer`, `content_hash text`, `storage_key text`, `created_at timestamptz`, all not null. Index on `(site_id, created_at, id)`. `storage_key` is internal and never leaves Content.

### Upload order
- Checks run in this order, and the first failure is returned: credentials (401), site (404 `site_not_found`), body size (413), `Content-Type` (415), multipart shape (`invalid_request`), file size (`invalid_image`), format and animation (`unsupported_image_type`), dimensions and pixel count (`invalid_image`), full decode (`invalid_image`).
- Content reads the whole file and runs every check before it writes anything.
- Then it writes the bytes, then inserts the row. If writing the bytes fails, no row is inserted and the request fails with 500. If the insert fails after the bytes are written, the orphaned file is accepted in this version.

### Ordering
- `GET /sites/{id}/assets` returns the site's assets newest first by `created_at`, ties broken by `id` ascending, as API-001.

### Duplicates
- Every upload creates a new asset, also when the same bytes were uploaded before. Both assets have the same `content_hash`.

### Side effects
- None. Uploading an asset raises no event and does not change the site snapshot (API-005), because no block can use an asset yet.

### Contracts
`Hivesite.Content.Contracts` offers, for other modules and in-process only. Neither method checks the owner; the caller (Publishing) already works for a site it is entitled to.
- `GetAsset(asset_id)` returns `AssetInfo { Id, SiteId, Filename, ContentType, SizeBytes, Width, Height, ContentHash, CreatedAt }` with the values of `GET /assets/{id}`, or `null` when no asset has this id.
- `OpenAssetContent(asset_id)` returns `AssetContent { ContentType, SizeBytes, ContentHash, Content }`, where `Content` is a read-only `Stream` of the original bytes, or `null` when no asset has this id. The caller disposes the stream.
- No internal type (the entity, the storage key, the storage interface) is part of the contract.

## Decisions
- **One stored original, no processing.** Variants, `srcset` and async processing are #97. Its `status` and `variants` fields will be added to the asset without changing the fields here.
- **Assets cannot be used in blocks yet.** The `image` definition of API-003 and the `image` field type of API-005 stay external `https://` URLs until #93 changes them. Assets are referenced by `id`; `content_type`, `width`, `height` and `content_hash` are enough for a renderer to name and size a file without calling Content.
- **SVG is not accepted** until a human decides the policy (open on #72). GIF, AVIF and HEIC are not accepted in this version.
- **Animated images are rejected,** so every frame count is 1 and the pixel cap is the whole decoding cost.
- **10 MB per file, 12,000 px per side, 40 megapixels.** Enough for a phone or camera JPEG, and small next to the 50 MB release cap of API-020. Release limits for photo sites are #100.
- **Width and height are as displayed** (EXIF orientation applied to the numbers), so a page can reserve the right space for a portrait phone photo.
- **The original keeps its metadata, including EXIF location.** This version serves it only to the site owner. Whether a release may publish an original with its metadata is decided with #95; #97 strips it from variants.
- **No delete and no storage or count limit** in this version; both are #96. Until then a site's library only grows.
- **The image library is not named here.** It must read dimensions from the header without decoding, decode fully, count frames and read EXIF orientation. Factory picks it before the build.
- Not in this version: dedupe by hash, a storage quota, delete, range requests, `Cache-Control` and `ETag` on content, `Content-Security-Policy` on content, an upload `Idempotency-Key`, resumable or chunked uploads, an asset event, and cleanup of orphaned files.

## Open questions
- none

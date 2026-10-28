---
id: API-003
title: Block type registry
domain: content
status: in review
owner: api-architect
stories: [14]
depends_on: [API-001]
version: 1
---

## Purpose
An owner can list the fixed set of block types, each with the JSON Schema its data must satisfy.

Auth, errors, validation and lists follow the shared conventions in API-001.

## Endpoints

### GET /block-types
Auth: owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /block-types
```

Response 200

The response holds all eight block types in the order of the table in Block types below. The first item is shown in full. The other seven have the same shape; each `schema` is exactly the schema given for that type below, with `$schema` and the full `$defs` object added in the same way.
```json
{
  "items": [
    {
      "type": "hero",
      "name": "Hero",
      "description": "A large opening section with a title, an optional image and one call to action.",
      "version": 1,
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": false,
        "required": ["title"],
        "properties": {
          "title": { "type": "string", "minLength": 1, "maxLength": 80 },
          "subtitle": { "type": "string", "maxLength": 160, "default": "" },
          "image": { "$ref": "#/$defs/image" },
          "cta": {
            "type": "object",
            "additionalProperties": false,
            "required": ["label", "href"],
            "properties": {
              "label": { "type": "string", "minLength": 1, "maxLength": 30 },
              "href": { "$ref": "#/$defs/link" }
            }
          }
        },
        "$defs": {
          "url": { "type": "string", "maxLength": 2048, "pattern": "^https://[^\\s]+$" },
          "link": { "type": "string", "maxLength": 2048, "pattern": "^(https://[^\\s]+|mailto:[^\\s]+|/(?:[a-z0-9-]+(?:/[a-z0-9-]+)*)?)$" },
          "image": {
            "type": "object",
            "additionalProperties": false,
            "required": ["url", "alt"],
            "properties": {
              "url": { "$ref": "#/$defs/url" },
              "alt": { "type": "string", "maxLength": 200 }
            }
          },
          "heading": { "type": "string", "minLength": 1, "maxLength": 120 }
        }
      }
    },
    { "type": "text", "name": "Text", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "image", "name": "Image", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "gallery", "name": "Gallery", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "cards", "name": "Cards", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "blog_list", "name": "Blog list", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "contact_form", "name": "Contact form", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "embed", "name": "Embed", "description": "…", "version": 1, "schema": { "…": "see Block types" } }
  ],
  "next_cursor": null
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`
- 401 `unauthenticated`

## Block types

| `type` | `name` | `description` |
|---|---|---|
| `hero` | Hero | A large opening section with a title, an optional image and one call to action. |
| `text` | Text | A heading and body text in a small Markdown subset. |
| `image` | Image | One image with alt text and an optional caption. |
| `gallery` | Gallery | A grid of 1 to 24 images. |
| `cards` | Cards | A row of 1 to 12 cards, each with a title, short text, image and link. |
| `blog_list` | Blog list | A dated list of 1 to 50 posts with excerpts and links. |
| `contact_form` | Contact form | A form of 1 to 10 fields that posts to an external address. |
| `embed` | Embed | A video or map from an allowed provider. |

Every served schema starts with `"$schema": "https://json-schema.org/draft/2020-12/schema"` and ends with the `$defs` object shown in the hero example above, unchanged. Below, only the part between them is given.

### hero
As in the response example above.

### text
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["body"],
  "properties": {
    "heading": { "$ref": "#/$defs/heading" },
    "body": { "type": "string", "minLength": 1, "maxLength": 10000 }
  }
}
```

### image
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["image"],
  "properties": {
    "image": { "$ref": "#/$defs/image" },
    "caption": { "type": "string", "maxLength": 200, "default": "" },
    "width": { "enum": ["content", "wide", "full"], "default": "content" }
  }
}
```

### gallery
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["images"],
  "properties": {
    "heading": { "$ref": "#/$defs/heading" },
    "images": {
      "type": "array",
      "minItems": 1,
      "maxItems": 24,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["url", "alt"],
        "properties": {
          "url": { "$ref": "#/$defs/url" },
          "alt": { "type": "string", "maxLength": 200 },
          "caption": { "type": "string", "maxLength": 200, "default": "" }
        }
      }
    },
    "columns": { "type": "integer", "minimum": 2, "maximum": 4, "default": 3 }
  }
}
```

### cards
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["cards"],
  "properties": {
    "heading": { "$ref": "#/$defs/heading" },
    "cards": {
      "type": "array",
      "minItems": 1,
      "maxItems": 12,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["title"],
        "properties": {
          "title": { "type": "string", "minLength": 1, "maxLength": 80 },
          "body": { "type": "string", "maxLength": 300, "default": "" },
          "image": { "$ref": "#/$defs/image" },
          "link": {
            "type": "object",
            "additionalProperties": false,
            "required": ["label", "href"],
            "properties": {
              "label": { "type": "string", "minLength": 1, "maxLength": 30 },
              "href": { "$ref": "#/$defs/link" }
            }
          }
        }
      }
    }
  }
}
```

### blog_list
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["posts"],
  "properties": {
    "heading": { "$ref": "#/$defs/heading" },
    "posts": {
      "type": "array",
      "minItems": 1,
      "maxItems": 50,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["title", "date", "href"],
        "properties": {
          "title": { "type": "string", "minLength": 1, "maxLength": 120 },
          "date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
          "excerpt": { "type": "string", "maxLength": 300, "default": "" },
          "href": { "$ref": "#/$defs/link" }
        }
      }
    }
  }
}
```

### contact_form
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["action_url", "fields"],
  "properties": {
    "heading": { "$ref": "#/$defs/heading" },
    "intro": { "type": "string", "maxLength": 300, "default": "" },
    "action_url": { "$ref": "#/$defs/url" },
    "fields": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "label", "kind"],
        "properties": {
          "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,39}$" },
          "label": { "type": "string", "minLength": 1, "maxLength": 60 },
          "kind": { "enum": ["text", "email", "phone", "textarea"] },
          "required": { "type": "boolean", "default": false }
        }
      }
    },
    "submit_label": { "type": "string", "minLength": 1, "maxLength": 30, "default": "Send" }
  }
}
```

### embed
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["provider", "url", "title"],
  "properties": {
    "provider": { "enum": ["youtube", "vimeo", "google_maps"] },
    "url": { "$ref": "#/$defs/url" },
    "title": { "type": "string", "minLength": 1, "maxLength": 120 },
    "aspect_ratio": { "enum": ["16:9", "4:3", "1:1"], "default": "16:9" }
  }
}
```

## Rules

### The registry
- The set of block types is fixed in code: exactly the eight above. There is no endpoint to add, change or remove a block type.
- `type` is the stable key that blocks refer to (API-004). It is `snake_case` and never changes.
- `version` is an integer, 1 for every type in this spec. Any change to a schema raises that type's `version` and needs a new version of this spec. A change that would make stored blocks invalid also needs its own story with a data migration.
- The response is the same for every owner and changes only when the code is deployed.
- The same registry, with the same schemas, is offered to other modules through `Hivesite.Content.Contracts`, so Rendering can rely on validated data without validating it again.

### Schemas
- JSON Schema draft 2020-12. Keywords used: `type`, `enum`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `default`, `$ref`, `$defs`. No others, so any 2020-12 validator gives the same result.
- `additionalProperties` is `false` on every object: unknown fields are rejected.
- `maxLength` and `minLength` count Unicode code points, as JSON Schema defines and as API-001 does.
- `default` says what API-004 stores when an optional field is left out. Optional fields without a `default` (`heading`, `image`, `cta`, `link`) stay absent when left out.

### Rules beyond the schemas
API-004 also checks these, with the same error as a schema failure:
- `url` and `link` targets: `https://` URLs must have a host. Site paths (`/` or `/about`) are not checked against existing pages, because pages can be renamed later.
- `blog_list.posts[].date` must be a real calendar date (`2026-02-30` fails).
- `contact_form.fields[].name` must be unique within the form.
- `embed.url` must belong to its `provider`:
  - `youtube`: host `www.youtube.com`, `youtube.com` or `youtu.be`
  - `vimeo`: host `vimeo.com` or `player.vimeo.com`
  - `google_maps`: host `www.google.com` and a path starting with `/maps/embed`
- `text.body` is Markdown limited to: paragraphs, line breaks, `**bold**`, `*italic*`, `[links](target)`, bullet lists, numbered lists, and headings `##` and `###`. Link targets must match `$defs/link`. Raw HTML and any other syntax are kept as literal text and are never rendered as HTML.

## Open questions
- Images are external `https://` URLs because the MVP has no asset upload. Is that acceptable, or does the MVP need an upload endpoint (and a story) before `hero`, `image`, `gallery` and `cards` are useful?
- Contact form submissions go to an external `action_url` (for example a form service), because published sites are static and Hivesite stores no submissions. Is that the intended design, or should Hivesite receive submissions (a new endpoint and story)?
- `blog_list` posts are written inline in the block, because the MVP has no post resource. Should it instead list pages of the site (for example by page id), or wait for a posts feature?
- Is the embed allowlist (YouTube, Vimeo, Google Maps) right for the MVP?

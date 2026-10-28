---
id: API-005
title: Entities
domain: content
status: in review
owner: api-architect
stories: [36]
depends_on: [API-001, API-002, API-003, API-004]
version: 1
---

## Purpose
A site owner can read the entity types of a site, read its entities, change its brand styling, and read the whole site as one snapshot for a template build.

Auth, ids, errors, validation, lists, timestamps and status codes follow the shared conventions in API-001. Pages are API-002, blocks API-004, block schemas, the Tiptap mapping and the shared `$defs` API-003. The architecture is ADR 3 (`docs/adr/0003-entities-and-vue-templates.md`).

## Concepts

- **Entity type.** A named field schema, keyed like block types (`page`, `brand_styling`). It lists its fields with their field types and serves a JSON Schema for its values. A type is a `collection` (many entities per site) or a `singleton` (exactly one per site).
- **Field.** One typed value of an entity: `text`, `rich_text`, `number`, `boolean`, `select`, `color`, `image`, `link` or `entity_reference` (see Field types).
- **Entity.** One record of a type in a site: an id, its type and a `values` object holding one value per field.
- **Built-in types.** This version has exactly two, fixed in code:
  - `page` (collection): a read-only view over the pages of API-002. It stores nothing of its own.
  - `brand_styling` (singleton): how the site looks. One per site, created with defaults.
- **Owner-defined types** are not in this version. They are a later story on the same table, schema and endpoints, and will add create and delete (see Decisions).

## Endpoints

### GET /sites/{id}/entity-types
Auth: site owner

Query: `limit` (1 to 100, default 20), `cursor`.

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/entity-types
```

Response 200

Both built-in types, in the order of Built-in entity types below. `page` is shown in full. The `brand_styling` item is exactly the response of `GET /sites/{id}/entity-types/brand_styling` below.
```json
{
  "items": [
    {
      "key": "page",
      "name": "Page",
      "description": "A page of the site. Pages and their blocks are changed through the pages and blocks endpoints.",
      "origin": "built_in",
      "cardinality": "collection",
      "operations": ["list", "read"],
      "version": 1,
      "title_field": "title",
      "fields": [
        {
          "key": "title",
          "name": "Title",
          "field_type": "text",
          "required": true,
          "nullable": false,
          "read_only": true,
          "config": { "min_length": 1, "max_length": 80, "pattern": null }
        },
        {
          "key": "slug",
          "name": "Slug",
          "field_type": "text",
          "required": true,
          "nullable": false,
          "read_only": true,
          "config": { "min_length": 1, "max_length": 60, "pattern": "^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$" }
        },
        {
          "key": "menu_order",
          "name": "Menu order",
          "field_type": "number",
          "required": true,
          "nullable": false,
          "read_only": true,
          "config": { "integer": true, "minimum": 0, "maximum": 49 }
        },
        {
          "key": "path",
          "name": "Path",
          "field_type": "link",
          "required": true,
          "nullable": false,
          "read_only": true,
          "config": {}
        }
      ],
      "schema": {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": false,
        "required": ["title", "slug", "menu_order", "path"],
        "properties": {
          "title": { "type": "string", "minLength": 1, "maxLength": 80 },
          "slug": { "type": "string", "minLength": 1, "maxLength": 60, "pattern": "^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$" },
          "menu_order": { "type": "integer", "minimum": 0, "maximum": 49 },
          "path": { "$ref": "#/$defs/link" }
        },
        "$defs": { "…": "exactly the object in Schema definitions" }
      }
    },
    { "key": "brand_styling", "name": "Brand styling", "…": "see GET /sites/{id}/entity-types/brand_styling" }
  ],
  "next_cursor": null
}
```

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100. `field` is `limit`.
- 400 `invalid_cursor`: `field` is `cursor`.
- 401 `unauthenticated`
- 404 `site_not_found`: as in API-001.

### GET /sites/{id}/entity-types/{key}
Auth: site owner

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/entity-types/brand_styling
```

Response 200
```json
{
  "key": "brand_styling",
  "name": "Brand styling",
  "description": "How the site looks: its theme and a few choices on top of it.",
  "origin": "built_in",
  "cardinality": "singleton",
  "operations": ["read", "update"],
  "version": 1,
  "title_field": null,
  "fields": [
    {
      "key": "theme",
      "name": "Theme",
      "field_type": "select",
      "required": false,
      "nullable": false,
      "read_only": false,
      "default": "atelier",
      "config": {
        "options": [
          { "value": "atelier", "label": "Atelier" },
          { "value": "ivory", "label": "Ivory" },
          { "value": "studio", "label": "Studio" }
        ]
      }
    },
    {
      "key": "display_font",
      "name": "Display font",
      "field_type": "select",
      "required": false,
      "nullable": false,
      "read_only": false,
      "default": "from_theme",
      "config": {
        "options": [
          { "value": "from_theme", "label": "From the theme" },
          { "value": "serif", "label": "Serif" },
          { "value": "grotesk", "label": "Grotesk" }
        ]
      }
    },
    {
      "key": "corners",
      "name": "Corners",
      "field_type": "select",
      "required": false,
      "nullable": false,
      "read_only": false,
      "default": "from_theme",
      "config": {
        "options": [
          { "value": "from_theme", "label": "From the theme" },
          { "value": "square", "label": "Square" },
          { "value": "subtle", "label": "Subtle" },
          { "value": "round", "label": "Round" }
        ]
      }
    },
    {
      "key": "accent_color",
      "name": "Accent color",
      "field_type": "color",
      "required": false,
      "nullable": true,
      "read_only": false,
      "default": null,
      "config": {
        "token": "color.accent_text",
        "contrast": { "against": ["color.background", "color.surface"], "min_ratio": 4.5 }
      }
    }
  ],
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "theme": { "enum": ["atelier", "ivory", "studio"], "default": "atelier" },
      "display_font": { "enum": ["from_theme", "serif", "grotesk"], "default": "from_theme" },
      "corners": { "enum": ["from_theme", "square", "subtle", "round"], "default": "from_theme" },
      "accent_color": { "oneOf": [{ "$ref": "#/$defs/color" }, { "type": "null" }], "default": null }
    },
    "$defs": { "…": "exactly the object in Schema definitions" }
  }
}
```

`GET /sites/{id}/entity-types/page` returns exactly the first item of the list example above.

Errors
- 401 `unauthenticated`
- 404 `site_not_found`
- 404 `entity_type_not_found`: no entity type with this key in this site. A key that does not match the key pattern in Rules gets the same 404.

### GET /sites/{id}/entities/{type}
Auth: site owner

The response depends on the type's `cardinality`:
- **collection**: a list of the site's entities of this type. Query: `limit` (1 to 100, default 20), `cursor`.
- **singleton**: the one entity, with an `ETag` header. No query parameters.

Request (collection)
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/entities/page?limit=2
```

Response 200 (collection)
```json
{
  "items": [
    {
      "id": "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "type": "page",
      "type_version": 1,
      "values": {
        "title": "Home",
        "slug": "home",
        "menu_order": 0,
        "path": "/"
      },
      "created_at": "2026-10-28T09:20:00Z",
      "updated_at": "2026-10-28T09:20:00Z"
    },
    {
      "id": "01a181d4-5e8b-75fc-bd2f-613219bf3f79",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "type": "page",
      "type_version": 1,
      "values": {
        "title": "About",
        "slug": "about",
        "menu_order": 1,
        "path": "/about"
      },
      "created_at": "2026-10-28T09:25:41Z",
      "updated_at": "2026-10-28T09:25:41Z"
    }
  ],
  "next_cursor": "c_eyJvIjoxfQ"
}
```

Request (singleton)
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/entities/brand_styling
```

Response 200 (singleton)

Headers: `ETag: "1"`
```json
{
  "id": "01a181c9-b7cb-7a42-8f1d-3c2e5b7a9d10",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "type": "brand_styling",
  "type_version": 1,
  "values": {
    "theme": "atelier",
    "display_font": "from_theme",
    "corners": "from_theme",
    "accent_color": null
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T09:14:03Z"
}
```

Errors
- 400 `invalid_request`: for a collection, `limit` is not an integer from 1 to 100 (`field` `limit`); for a singleton, `limit` or `cursor` is present (`field` names it).
- 400 `invalid_cursor`: `field` is `cursor`.
- 401 `unauthenticated`
- 404 `site_not_found`
- 404 `entity_type_not_found`

### PATCH /sites/{id}/entities/{type}
Auth: site owner

Headers: `Content-Type: application/json`, `If-Match` (optional, see Concurrency)

Changes the singleton entity of a type. In this version that is `brand_styling`. `values` is merged one level deep: each field sent replaces its stored value whole, and a field left out keeps its value. `null` resets a `nullable` field. An empty object `{}` or `{ "values": {} }` changes nothing and returns 200. JSON Patch is not offered for entities.

Request
```
PATCH /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/entities/brand_styling
Content-Type: application/json
If-Match: "1"
```
```json
{
  "values": {
    "theme": "ivory",
    "accent_color": "#2f6b5a"
  }
}
```

Response 200

Headers: `ETag: "2"`
```json
{
  "id": "01a181c9-b7cb-7a42-8f1d-3c2e5b7a9d10",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "type": "brand_styling",
  "type_version": 1,
  "values": {
    "theme": "ivory",
    "display_font": "from_theme",
    "corners": "from_theme",
    "accent_color": "#2F6B5A"
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T10:42:18Z"
}
```

`#2F6B5A` has 5.53:1 on Ivory's `color.background` `#F5F1E8` and 5.88:1 on its `color.surface` `#FBF8F2`, so it passes.

Response 400 (contrast)

Request body `{ "values": { "theme": "ivory" } }` while the stored `accent_color` is `#CDAE74`. The check runs on the merged values, so it fails although `accent_color` was not sent:
```json
{
  "error": {
    "code": "contrast_too_low",
    "message": "accent_color #CDAE74 has 1.88:1 on color.background #F5F1E8 of theme ivory; it needs at least 4.5:1. Send a new accent_color or null with the theme.",
    "field": "/values/accent_color"
  }
}
```

Errors
- 400 `invalid_request`: the body is not a JSON object, it has a field other than `values`, `values` is not an object, or `If-Match` is `*` or holds more than one value (`field` `If-Match`).
- 400 `operation_not_supported`: the type is a collection (in this version `page`, which changes through API-002 and API-004). `field` is left out.
- 400 `invalid_value`: a value in the merged `values` fails the type's schema or a rule in Field types: an unknown field, a wrong type, `null` for a field that is not `nullable`, a value out of range, a read-only field sent. `field` is its pointer, for example `/values/corners`, and the message names the problem.
- 400 `invalid_reference`: an `entity_reference` value names no entity of the field's `config.entity_type` in this site. `field` is its pointer. (No built-in type has such a field in this version.)
- 400 `contrast_too_low`: a `color` value has less than its field's `min_ratio` against one of its `against` tokens in the site's theme. `field` is its pointer, as in the example.
- 401 `unauthenticated`
- 404 `site_not_found`
- 404 `entity_type_not_found`
- 412 `precondition_failed`: `If-Match` was sent and is not the current `ETag`. Nothing changes.
- 413 `request_too_large`: the body is larger than 256 KB.
- 415 `unsupported_media_type`: `Content-Type` is not `application/json`.

### GET /entities/{id}
Auth: site owner

Reads one entity by id, of any type. A page's entity id is its page id (API-002).

Request
```
GET /entities/01a181c9-b7cb-7a42-8f1d-3c2e5b7a9d10
```

Response 200

Headers: `ETag: "2"`

The same body as the singleton GET or PATCH above for this entity:
```json
{
  "id": "01a181c9-b7cb-7a42-8f1d-3c2e5b7a9d10",
  "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
  "type": "brand_styling",
  "type_version": 1,
  "values": {
    "theme": "ivory",
    "display_font": "from_theme",
    "corners": "from_theme",
    "accent_color": "#2F6B5A"
  },
  "created_at": "2026-10-28T09:14:03Z",
  "updated_at": "2026-10-28T10:42:18Z"
}
```

For a page id the body is that page's item as in the collection example above, and there is no `ETag` header (pages have no entity version; blocks have their own `ETag` in API-004).

Errors
- 401 `unauthenticated`
- 404 `entity_not_found`: no entity or page with this id, or its site belongs to another owner.

### GET /sites/{id}/snapshot
Auth: site owner

Everything a template build needs, in one consistent read: the site, the entity types, every entity, and each page's blocks. Rendering passes the same document into the build sandbox through `Hivesite.Content.Contracts` (ADR 3); this endpoint returns it over HTTP for the admin and for developers working on a template.

Headers: `If-None-Match` (optional), `Accept-Encoding: gzip` (optional)

Request
```
GET /sites/01a181c9-b7ca-70bc-abf5-a9e81e300af7/snapshot
```

Response 200

Headers: `ETag: "s_9c41e07a5b3d2f18"`

`entity_types` holds each type exactly as `GET /sites/{id}/entity-types/{key}` returns it, without `schema`; one is shortened here. Each page entity carries `blocks`, its API-004 document as `GET /pages/{id}/blocks` returns it.
```json
{
  "snapshot_format": 1,
  "site": {
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
  "entity_types": [
    { "key": "page", "name": "Page", "…": "as GET /sites/{id}/entity-types/page, without schema" },
    {
      "key": "brand_styling",
      "name": "Brand styling",
      "description": "How the site looks: its theme and a few choices on top of it.",
      "origin": "built_in",
      "cardinality": "singleton",
      "operations": ["read", "update"],
      "version": 1,
      "title_field": null,
      "fields": [
        { "key": "theme", "name": "Theme", "field_type": "select", "required": false, "nullable": false, "read_only": false, "default": "atelier", "config": { "options": [{ "value": "atelier", "label": "Atelier" }, { "value": "ivory", "label": "Ivory" }, { "value": "studio", "label": "Studio" }] } },
        { "key": "display_font", "name": "Display font", "field_type": "select", "required": false, "nullable": false, "read_only": false, "default": "from_theme", "config": { "options": [{ "value": "from_theme", "label": "From the theme" }, { "value": "serif", "label": "Serif" }, { "value": "grotesk", "label": "Grotesk" }] } },
        { "key": "corners", "name": "Corners", "field_type": "select", "required": false, "nullable": false, "read_only": false, "default": "from_theme", "config": { "options": [{ "value": "from_theme", "label": "From the theme" }, { "value": "square", "label": "Square" }, { "value": "subtle", "label": "Subtle" }, { "value": "round", "label": "Round" }] } },
        { "key": "accent_color", "name": "Accent color", "field_type": "color", "required": false, "nullable": true, "read_only": false, "default": null, "config": { "token": "color.accent_text", "contrast": { "against": ["color.background", "color.surface"], "min_ratio": 4.5 } } }
      ]
    }
  ],
  "entities": {
    "page": [
      {
        "id": "01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0",
        "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
        "type": "page",
        "type_version": 1,
        "values": { "title": "Home", "slug": "home", "menu_order": 0, "path": "/" },
        "created_at": "2026-10-28T09:20:00Z",
        "updated_at": "2026-10-28T09:20:00Z",
        "blocks": {
          "type": "doc",
          "content": [
            {
              "type": "hero",
              "attrs": {
                "title": "Made slowly, by hand",
                "subtitle": "",
                "image": null,
                "cta": { "label": "See the work", "href": "/about" }
              }
            }
          ]
        }
      },
      {
        "id": "01a181d4-5e8b-75fc-bd2f-613219bf3f79",
        "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
        "type": "page",
        "type_version": 1,
        "values": { "title": "About", "slug": "about", "menu_order": 1, "path": "/about" },
        "created_at": "2026-10-28T09:25:41Z",
        "updated_at": "2026-10-28T09:25:41Z",
        "blocks": { "type": "doc", "content": [] }
      }
    ],
    "brand_styling": {
      "id": "01a181c9-b7cb-7a42-8f1d-3c2e5b7a9d10",
      "site_id": "01a181c9-b7ca-70bc-abf5-a9e81e300af7",
      "type": "brand_styling",
      "type_version": 1,
      "values": {
        "theme": "ivory",
        "display_font": "from_theme",
        "corners": "from_theme",
        "accent_color": "#2F6B5A"
      },
      "created_at": "2026-10-28T09:14:03Z",
      "updated_at": "2026-10-28T10:42:18Z"
    }
  }
}
```

Response 304

When `If-None-Match` holds the current `ETag`. No body.

Errors
- 400 `invalid_request`: `If-None-Match` is `*` or holds more than one value. `field` is `If-None-Match`.
- 401 `unauthenticated`
- 404 `site_not_found`

## Field types

Each field in an entity type has these attributes, always in this order and always present, except `default`:

| Attribute | Meaning |
|---|---|
| `key` | The key in `values`. Pattern `^[a-z][a-z0-9_]{0,39}$`, unique within the type, never changes. |
| `name` | Label for the admin, 1 to 60 characters. |
| `field_type` | One of the nine below. |
| `required` | `true`: the value must be given when the entity is created, and the field has no `default`. `false`: the field has a `default`, used when the value is left out. |
| `nullable` | `true`: `null` is a valid value and means "not set". Only `number`, `color`, `image`, `link` and `entity_reference` fields can be nullable. |
| `read_only` | `true`: the value is set by Hivesite or managed through another endpoint. Sending it returns 400 `invalid_value`. |
| `default` | Present only when `required` is `false`. A valid value of the field, or `null` when `nullable`. |
| `config` | An object whose keys depend on `field_type`, as below. `{}` when the field type has none. All its keys are always present. |

| `field_type` | Value | `config` | JSON Schema of the value |
|---|---|---|---|
| `text` | Plain string, trimmed as in API-001, never parsed. | `min_length` 0 to 2000, `max_length` 1 to 2000, `pattern` a regular expression or `null` (max 200 characters). | `{ "type": "string", "minLength": …, "maxLength": …, "pattern": … }`, `pattern` left out when `null`. |
| `rich_text` | A Tiptap document `{ "type": "doc", "content": [ … ] }` with the rich text nodes and marks of API-003, never HTML or Markdown. Default `{ "type": "doc", "content": [] }`. | `{}` | `{ "$ref": "#/$defs/rich_text_doc" }` |
| `number` | JSON number. | `integer` boolean, `minimum` and `maximum` numbers or `null` (no bound). | `{ "type": "integer" }` or `{ "type": "number" }`, with `minimum`/`maximum` when set. |
| `boolean` | `true` or `false`. Default `false` unless the type says otherwise. | `{}` | `{ "type": "boolean" }` |
| `select` | One option `value`. | `options`: 1 to 50 objects `{ "value", "label" }`; `value` pattern `^[a-z][a-z0-9_]{0,39}$`, unique; `label` 1 to 60 characters. | `{ "enum": [ …values ] }` |
| `color` | `#RRGGBB` hex. Accepted in any letter case, stored and returned uppercase. No alpha. | `token`: the design token the value fills, for example `"color.accent_text"`, or `null`. `contrast`: `{ "against": [token, …], "min_ratio": number }` or `null`. See Color fields and contrast. | `{ "$ref": "#/$defs/color" }` |
| `image` | `{ "url", "alt" }`, an external `https://` image as API-003. | `{}` | `{ "$ref": "#/$defs/image" }` |
| `link` | A link string as API-003: `https://…`, `mailto:…` or a site path (`/`, `/about`). | `{}` | `{ "$ref": "#/$defs/link" }` |
| `entity_reference` | The id of another entity in the same site. Accepted in any letter case, stored and returned lowercase. | `entity_type`: the key of the type it must point to. | `{ "$ref": "#/$defs/entity_id" }` |

- A `nullable` field's schema is `{ "oneOf": [ <schema above>, { "type": "null" } ] }`.
- A field with `required: false` adds `"default": <default>` to its schema. Its key is listed in the type schema's `required` only when `required` is `true`.
- `rich_text` values follow API-003 "Rules beyond the schemas" for rich text: at most 10,000 code points of text in total, lists at most 3 levels deep, a `listItem` starts with a `paragraph`, a mark type at most once per `text` node, and `text` is never trimmed. A `rich_text` value has at most 200 top-level nodes.
- `image` and `link` values follow API-003's URL rules: an `https://` URL must have a host; site paths are not checked against existing pages.
- `number` values are finite and between -9,007,199,254,740,991 and 9,007,199,254,740,991. With `integer: true` they have no fraction.
- `entity_reference` values are checked on every write: the target must exist in the same site and be of `config.entity_type`, or the write fails with 400 `invalid_reference`. A reference whose target is later deleted keeps its stored id; reads return it as stored and the snapshot does not contain the target, so a template treats it as not set. The next write of the entity fails with `invalid_reference` until the value is changed.

### Schema definitions
Every served entity type schema starts with `"$schema": "https://json-schema.org/draft/2020-12/schema"` and ends with one `$defs` object: exactly the Shared definitions of API-003, plus these three.
```json
{
  "color": { "type": "string", "pattern": "^#[0-9A-Fa-f]{6}$" },
  "entity_id": {
    "type": "string",
    "pattern": "^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-7[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$"
  },
  "rich_text_doc": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "content"],
    "properties": {
      "type": { "const": "doc" },
      "content": {
        "type": "array",
        "maxItems": 200,
        "items": {
          "oneOf": [
            { "$ref": "#/$defs/paragraph" },
            { "$ref": "#/$defs/heading_node" },
            { "$ref": "#/$defs/bullet_list" },
            { "$ref": "#/$defs/ordered_list" }
          ]
        }
      }
    }
  }
}
```

- Schemas use only the keywords listed in API-003 Schemas, so any 2020-12 validator gives the same result. `additionalProperties` is `false` on every object.
- A type schema validates the stored `values` object. On a write, Content first merges the request into the stored values (or, on create, fills in defaults), then validates the result.
- What the admin and templates need beyond validation (labels, `read_only`, token slots, contrast rules) is in `fields`, not in the schema.

## Built-in entity types

| `key` | `name` | `cardinality` | `operations` | Stored in |
|---|---|---|---|---|
| `page` | Page | collection | `list`, `read` | `content.pages` and the blocks of API-004. Nothing in `content.entities`. |
| `brand_styling` | Brand styling | singleton | `read`, `update` | One row per site in `content.entities`. |

### page
`page` is a view, not a copy. Content builds each page entity from the page and its blocks when it is read:

| Entity | From API-002 / API-004 |
|---|---|
| `id` | The page `id`. |
| `site_id`, `created_at`, `updated_at` | The page's own. |
| `values.title`, `values.slug`, `values.menu_order` | The page's own fields, unchanged. |
| `values.path` | `/` for the page with `menu_order` 0 (the home page, API-002), `/{slug}` for every other page. The same link API-003 `card_list` collections use. |
| `blocks` (snapshot only) | The page's blocks document, as `GET /pages/{id}/blocks`. |

- Every field is `read_only`. Pages are created, changed, reordered and deleted only through API-002, and their blocks only through API-004. Those specs do not change.
- `PATCH /sites/{id}/entities/page` returns 400 `operation_not_supported`.
- The `page` entity type is the `entity_type` `page` of API-003's `card_list` collection source. Its `title_field` and `path` fill the card's title and link, as API-003 says.
- A page entity has no entity version and no `ETag`.

### brand_styling
How the site looks: one theme plus a few choices on top of it. Every value names design tokens in `design/tokens.json` (version 1, from #33) and adds no CSS of its own.

| Field | Type | Values | Default | Meaning |
|---|---|---|---|---|
| `theme` | `select` | `atelier`, `ivory`, `studio` | `atelier` | The theme whose tokens the site uses. The default is `default_theme` in `design/tokens.json`. |
| `display_font` | `select` | `from_theme`, `serif`, `grotesk` | `from_theme` | The font of the hero title and block headings. `from_theme` keeps the theme's `font.display`; `serif` uses `font.display` of `atelier` (Cormorant Garamond), `grotesk` that of `studio` (Hanken Grotesk). |
| `corners` | `select` | `from_theme`, `square`, `subtle`, `round` | `from_theme` | Corners of buttons, cards and media. `from_theme` keeps the theme's `radius.*`; `square`, `subtle` and `round` use the `radius.*` of `studio`, `atelier` and `ivory`. |
| `accent_color` | `color`, nullable | `#RRGGBB` or `null` | `null` | Fills the token `color.accent_text`: links, eyebrows and accent words. `null` keeps the theme's own value. Checked for contrast, see below. |

- Every site has exactly one `brand_styling` entity. Content creates it with the defaults in the same transaction as `POST /sites` (API-001); the site response does not change. A migration creates one with the defaults for every site that exists before this spec is built.
- It cannot be created or deleted through the API. It has its own UUIDv7 id, readable through `GET /entities/{id}`.
- Templates read it from the snapshot. What a template does with it is the template's concern (ADR 3); the default template applies the meanings above.
- Brand styling is not a site field. A site's look is read only from this entity.

## Color fields and contrast
- A `color` field with a `token` fills that design-token slot: a template uses the value in place of the theme's token. With `null` the theme's own value stays.
- A `color` field with `contrast` is checked on every write of its entity: its value must have at least `min_ratio` against each token in `against`, taken from the site's theme. The theme is the `theme` value of the site's `brand_styling` after the write is merged, so a PATCH that only changes `theme` checks the stored color against the new theme.
- The ratio is the WCAG 2.2 contrast ratio, `(L1 + 0.05) / (L2 + 0.05)` of the two relative luminances, computed exactly as `design/check-contrast.mjs` does, and compared unrounded. `4.5` is WCAG AA for normal text. Messages show the ratio rounded to two decimals.
- `against` tokens are checked in order; the first failure is returned as 400 `contrast_too_low` with `field` the value's pointer. `null` is never checked.
- In this version only `brand_styling.accent_color` is a color field. It is checked at 4.5:1 against `color.background` and `color.surface`, the backgrounds `design/README.md` requires for `color.accent_text`.
- Content holds the theme colors it checks against as a table, a copy of `design/tokens.json` version 1. A test reads `design/tokens.json` and fails when they differ. A theme or token change there needs a new version of this spec.

| Theme | `color.background` | `color.surface` |
|---|---|---|
| `atelier` | `#100E0B` | `#17140F` |
| `ivory` | `#F5F1E8` | `#FBF8F2` |
| `studio` | `#FAF8F4` | `#FFFFFF` |

## Rules

### Entity types
- Entity types in this version are fixed in code: exactly `page` and `brand_styling`. There is no endpoint to add, change or remove a type.
- `key` pattern `^[a-z][a-z0-9_]{1,39}$`. It never changes. Built-in keys are reserved for all sites.
- `origin` is `built_in` for both. Owner-defined types will have `owner_defined`.
- `cardinality` is `collection` or `singleton`. `operations` lists what the API offers for the type, from `list`, `read`, `create`, `update`, `delete`, in that order. No type has `create` or `delete` in this version.
- `version` is an integer, 1 for both types. A change to a type's fields raises its `version` and needs a new version of this spec; one that makes stored values invalid also needs a story with a data migration. Each entity records the `type_version` it was validated with.
- `title_field` is the key of the `text` field that names an entity, or `null` when the type has none.
- `fields` are in the order the admin shows them. `values` objects in responses have their keys in the same order.
- Types are listed under a site (`/sites/{id}/entity-types`), although built-in types are the same in every site, so the paths stay the same when owner-defined types arrive.
- Max 50 fields per type.

### Entities
- `id`: a UUIDv7 as API-001, set by the server. A page entity's id is its page id.
- `type`: the entity type key. `type_version`: as above.
- `values`: one value per field of the type, always every field, never a key that is not a field. `null` only for `nullable` fields.
- `created_at`, `updated_at`: as API-001. `updated_at` changes on every write that changes a value.
- Entities never move between sites or types.

### Storage
- Entities other than pages are rows of one table, `content.entities`: `id uuid` primary key, `site_id uuid` not null with a foreign key to `content.sites`, `type_key text` not null, `type_version integer` not null, `values jsonb` not null, `version integer` not null (the `ETag`), `created_at` and `updated_at` `timestamptz` not null.
- Index on `(site_id, type_key, id)`. A unique partial index on `(site_id, type_key)` for each singleton type (`WHERE type_key = 'brand_styling'`) keeps it to one per site.
- On read, a field missing from stored `values` takes its `default`, so adding a non-required field to a type needs no data migration.
- Pages stay in their API-002 tables and are never copied into `content.entities`.

### Limits
- Request body max 256 KB (262,144 bytes) for PATCH. Larger returns 413 `request_too_large` before parsing.
- Stored `values` max 256 KB as compact UTF-8 JSON. A merged result that is larger returns 400 `invalid_value` with `field` `/values`.
- One `brand_styling` entity per site. Pages: max 50 per site (API-002).
- Field limits are in Field types; text up to 2,000 code points, select up to 50 options, rich text up to 10,000 code points and 200 top-level nodes.
- Snapshot: at most 14 MB (14,680,064 bytes) uncompressed. With the limits of API-002 and API-004 (50 pages, 256 KB of blocks each) it cannot be larger. It is gzip-compressed when the request sends `Accept-Encoding: gzip`.

### Ordering
- `GET /sites/{id}/entity-types`: built-in types in the order of the Built-in entity types table.
- `GET /sites/{id}/entities/page` and `entities.page` in the snapshot: by `menu_order` ascending, as API-002.

### Validation
- `PATCH /sites/{id}/entities/{type}` checks run in this order, and the first failure is returned: credentials (401), site (404 `site_not_found`), type (404 `entity_type_not_found`), cardinality (`operation_not_supported`), body size (413), `Content-Type` (415), `If-Match` (`invalid_request`, then 412), body shape (`invalid_request`), then each field of `values` in the type's field order: unknown key, then `read_only`, then the schema and the rules in Field types (`invalid_value`), then references (`invalid_reference`), then contrast (`contrast_too_low`), then the stored size (`invalid_value`). Unknown keys are reported before any known field.
- Plain `text` values are trimmed before they are checked and stored, as API-001. `color` values are stored uppercase, `entity_reference` values lowercase.
- Validation is all or nothing: if any value fails, nothing is stored.
- Stored values are valid against the schema of their `type_version`. Readers in other modules trust them and do not validate again.

### Concurrency
- Each stored entity has a version, an integer that is 1 when it is created and goes up by 1 on every change. Its `ETag` is that integer in quotes, a strong ETag, as API-004.
- `PATCH` takes an optional `If-Match` with exactly one ETag. With it, a stale value returns 412 `precondition_failed` and nothing changes. Without it, the PATCH applies to whatever is stored. The admin sends `If-Match` on every PATCH.
- The check and the write happen in one transaction.
- A PATCH whose merged result equals the stored values changes nothing: 200, the same `ETag`, the same `updated_at`, no event.
- PATCH is idempotent and takes no `Idempotency-Key`. No endpoint in this spec creates anything over HTTP.

### Snapshot
- One read in one database transaction at `REPEATABLE READ` isolation, so the site, pages, blocks and entities in it belong to the same moment.
- `snapshot_format` is 1. A change to the snapshot's shape raises it and needs a new version of this spec. Adding an entity type adds a key to `entities` and an item to `entity_types` without raising it.
- `entities` has one key per entity type of the site, in `entity_types` order: a collection's value is an array of all its entities (not paged), a singleton's value is its entity.
- The body is deterministic: the same stored state gives the same bytes. Keys appear in the order of the examples, there is no time of reading in it, and JSON is written compact in UTF-8. The `ETag` is `"s_"` plus the first 16 hex digits of the SHA-256 of those bytes, so a build can skip work when nothing changed. Clients treat it as opaque.
- It holds no owner data beyond the site's own content: no owner id, no email, no other sites.

### Contracts
`Hivesite.Content.Contracts` offers, for other modules and in-process only:
- `GetEntityTypes(site_id)` and `GetEntityType(site_id, key)`, with the same data as the HTTP responses.
- `GetEntity(entity_id)`, `GetSingleton(site_id, type_key)` and `ListEntities(site_id, type_key)` (all entities of a collection, in the order above).
- `GetBrandStyling(site_id)`, returning the record `BrandStyling { Theme, DisplayFont, Corners, AccentColor }` with the enums `ThemeKey` (`Atelier`, `Ivory`, `Studio`), `DisplayFont` (`FromTheme`, `Serif`, `Grotesk`) and `Corners` (`FromTheme`, `Square`, `Subtle`, `Round`), and `AccentColor` an uppercase `#RRGGBB` string or null.
- `GetSiteSnapshot(site_id)`, returning the snapshot bytes and their `ETag`, byte-identical to the uncompressed body of `GET /sites/{id}/snapshot`. Rendering writes these bytes into the build sandbox as they are (ADR 3).

### Side effects
Raised through `Hivesite.Content.Contracts` after the change is saved:
- `EntityChanged { entity_id, site_id, entity_type, change: "created" | "updated" }` for entities in `content.entities`: `created` when a site's `brand_styling` is created with the site, `updated` on a PATCH that changes a value. A no-op PATCH raises nothing. Owner-defined types will add `"deleted"`.
- Page changes keep raising `PageChanged` and `MenuChanged` (API-002, API-004) and raise no `EntityChanged`.
- A site's snapshot changes exactly when one of `SiteChanged`, `PageChanged`, `MenuChanged` or `EntityChanged` is raised for it. Consumers that rebuild a preview listen to these four.

## Decisions
- **`page` is a view over API-002, not a migration into `content.entities`** (owner decision). Pages keep their tables, endpoints, menu rules and events, so stories #13 and #15 are unaffected and nothing is stored twice. The entity id is the page id, so a reference to a page is a page id.
- **Brand styling is an entity, not a site field.** It is the first type stored in `content.entities`, so the generic engine is built and tested with a real type before owner-defined types arrive. It replaces the `brand_styling` site field proposed in PR #34.
- **The accent color fills `color.accent_text` only,** not the button fill `color.accent`. A button fill also needs a text color on it (`color.on_accent`) with its own check. See Open questions.
- **Contrast is checked against `color.background` and `color.surface`,** both, because `design/README.md` requires 4.5:1 on both for `color.accent_text` and text on cards sits on `surface`. See Open questions.
- **A theme change that breaks the stored accent color fails with `contrast_too_low`** rather than clearing the color silently. The admin sends `accent_color` (a new color or `null`) together with the new theme.
- **Content keeps a copy of the theme backgrounds,** checked by a test against `design/tokens.json`. Content cannot read Rendering's internals (ADR 1), and the check must not depend on a template.
- **Field metadata is in `fields`, validation is in `schema`.** Schemas keep API-003's keyword list, so any validator works; labels, token slots and contrast rules need no custom keywords.
- **Only singleton writes in this version.** No built-in collection type is writable through this API. Create (`POST /sites/{id}/entities/{type}`), update (`PATCH /entities/{id}`) and delete (`DELETE /entities/{id}`) for collections come with owner-defined types, as a new version of this spec, and `card_list` then accepts their keys (API-003 says they "will plug in").
- **The snapshot has its own endpoint and contract,** so a build gets everything in one consistent read and the same bytes reach the sandbox and a developer's machine.

## Open questions
- Should `accent_color` also fill the button fill `color.accent`? Then Content must also pick or check `color.on_accent` on it (4.5:1), for example the theme's `color.text` or `color.background`, whichever passes.
- Contrast against `color.background` and `color.surface` (proposed), or `color.background` only, as first described?
- The theme table and the `brand_styling` values depend on `design/tokens.json` in #33, which is not merged. Is version 1 of that file final, so this spec can cite it?

---
id: API-003
title: Block type registry
domain: content
status: in review
owner: api-architect
stories: [14]
depends_on: [API-001]
version: 3
---

## Purpose
An owner can list the fixed set of block types, each with the JSON Schema its Tiptap node must satisfy.

Auth, errors, validation and lists follow the shared conventions in API-001.

## Endpoints

### GET /block-types
Auth: owner

Query: `limit` (1 to 100, default 20), `cursor` (from `next_cursor` of the previous page).

Block types have no id; their key is `type`. So `next_cursor` is the `type` of the last item on the page, or `null` on the last page. The next page starts with the block type after `cursor` in the order of the table in Block types.

Request
```
GET /block-types
```

Response 200

The response holds all seven block types in the order of the table in Block types below. The first item is shown in full. The other six have the same shape; each `schema` is exactly the schema given for that type below, with `$schema` and the `$defs` object from Shared definitions added in the same way.
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
        "required": ["type", "attrs"],
        "properties": {
          "type": { "const": "hero" },
          "attrs": {
            "type": "object",
            "additionalProperties": false,
            "required": ["title"],
            "properties": {
              "title": { "type": "string", "minLength": 1, "maxLength": 80 },
              "subtitle": { "type": "string", "maxLength": 160, "default": "" },
              "image": { "oneOf": [{ "$ref": "#/$defs/image" }, { "type": "null" }], "default": null },
              "cta": { "oneOf": [{ "$ref": "#/$defs/action" }, { "type": "null" }], "default": null }
            }
          }
        },
        "$defs": { "…": "exactly the object in Shared definitions" }
      }
    },
    { "type": "rich_text", "name": "Rich text", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "image", "name": "Image", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "gallery", "name": "Gallery", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "card_list", "name": "Card list", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "contact_form", "name": "Contact form", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "embed", "name": "Embed", "description": "…", "version": 1, "schema": { "…": "see Block types" } }
  ],
  "next_cursor": null
}
```

Paged example. With `limit=3`, the first page holds `hero`, `rich_text` and `image`.
```
GET /block-types?limit=3
```
```json
{
  "items": [
    { "type": "hero", "name": "Hero", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "rich_text", "name": "Rich text", "description": "…", "version": 1, "schema": { "…": "see Block types" } },
    { "type": "image", "name": "Image", "description": "…", "version": 1, "schema": { "…": "see Block types" } }
  ],
  "next_cursor": "image"
}
```
`GET /block-types?limit=3&cursor=image` returns `gallery`, `card_list` and `contact_form` with `next_cursor` `"contact_form"`. `GET /block-types?limit=3&cursor=contact_form` returns `embed` with `next_cursor` `null`.

Errors
- 400 `invalid_request`: `limit` is not an integer from 1 to 100.
- 400 `invalid_cursor`: `cursor` is not the `type` of one of the seven block types. `field` is `cursor`.
- 401 `unauthenticated`

## Tiptap mapping

Blocks are Tiptap (ProseMirror) nodes, so the admin editor can load and save them with Tiptap as they are, and new blocks can be added as new nodes later.

- **Page.** The blocks of a page form one Tiptap document, `{ "type": "doc", "content": [ block, … ] }` (API-004). `editor.getJSON()` gives that document; `editor.commands.setContent(doc)` loads it.
- **Block.** Each block is a top-level node of that document. The block type key is the node name (`"type": "hero"`). The block's fields are the node's `attrs`.
- **Attributes.** Every attribute in a schema below is a Tiptap node attribute with the same name and default. Stored blocks always carry every attribute. An optional attribute with no value is `null`, as Tiptap stores it; strings default to `""` where the schema says so.
- **Atoms and content.** `rich_text` is the only block with `content`: its rich text is edited inline in the page editor. Every other block is an atom (no `content`); the editor shows it as a node view with a form for its attributes.
- **Rich text.** Rich text is Tiptap JSON, never Markdown or HTML. It uses only these Tiptap nodes and marks, with Tiptap's own names: nodes `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `hardBreak`, `text`; marks `bold`, `italic`, `link`. The admin editor enables StarterKit and Link with everything else turned off, so its output validates. If an installed Tiptap version emits an attribute these schemas do not allow, that is a change to this spec, not to the code.
- **Plain strings.** Every other string attribute (titles, captions, labels, alt text) is plain text. It is never parsed, and Rendering escapes it.
- **Growing.** A later block that needs structured children gets them as child nodes in `content` (for example a `card` node), not as Markdown or HTML in a string. A block type that needs rich text in a field gets a child node or a `rich_text`-style `content`, using the nodes above.

## Block types

| `type` | `name` | `description` |
|---|---|---|
| `hero` | Hero | A large opening section with a title, an optional image and one call to action. |
| `rich_text` | Rich text | Headings, paragraphs and lists, with bold, italic and links. |
| `image` | Image | One image with alt text and an optional caption. |
| `gallery` | Gallery | A grid of 1 to 24 images. |
| `card_list` | Card list | Cards in a grid or a list, written by hand or drawn from a collection such as the site's pages, paged. |
| `contact_form` | Contact form | A form of 1 to 10 fields that posts to an external address. |
| `embed` | Embed | A video or map from an allowed provider. |

Every served schema starts with `"$schema": "https://json-schema.org/draft/2020-12/schema"` and ends with the `$defs` object from Shared definitions, unchanged. Below, only the part between them is given. Each schema validates a whole node: `type` and `attrs`, plus `content` for `rich_text`.

### hero
As in the response example above.

### rich_text
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "content"],
  "properties": {
    "type": { "const": "rich_text" },
    "content": {
      "type": "array",
      "minItems": 1,
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
```

Example node:
```json
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
```

### image
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "attrs"],
  "properties": {
    "type": { "const": "image" },
    "attrs": {
      "type": "object",
      "additionalProperties": false,
      "required": ["image"],
      "properties": {
        "image": { "$ref": "#/$defs/image" },
        "caption": { "type": "string", "maxLength": 200, "default": "" },
        "width": { "enum": ["content", "wide", "full"], "default": "content" }
      }
    }
  }
}
```

### gallery
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "attrs"],
  "properties": {
    "type": { "const": "gallery" },
    "attrs": {
      "type": "object",
      "additionalProperties": false,
      "required": ["images"],
      "properties": {
        "heading": { "$ref": "#/$defs/heading", "default": "" },
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
  }
}
```

### card_list
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "attrs"],
  "properties": {
    "type": { "const": "card_list" },
    "attrs": {
      "type": "object",
      "additionalProperties": false,
      "required": ["source"],
      "properties": {
        "heading": { "$ref": "#/$defs/heading", "default": "" },
        "layout": { "enum": ["grid", "list"], "default": "grid" },
        "source": {
          "oneOf": [
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["kind", "cards"],
              "properties": {
                "kind": { "const": "manual" },
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
                      "image": { "oneOf": [{ "$ref": "#/$defs/image" }, { "type": "null" }], "default": null },
                      "action": { "oneOf": [{ "$ref": "#/$defs/action" }, { "type": "null" }], "default": null }
                    }
                  }
                }
              }
            },
            {
              "type": "object",
              "additionalProperties": false,
              "required": ["kind", "entity_type"],
              "properties": {
                "kind": { "const": "collection" },
                "entity_type": { "enum": ["page"] },
                "sort": { "enum": ["natural", "newest", "title"], "default": "natural" },
                "page_size": { "type": "integer", "minimum": 1, "maximum": 50, "default": 12 }
              }
            }
          ]
        }
      }
    }
  }
}
```

Example node, bound to the site's pages:
```json
{
  "type": "card_list",
  "attrs": {
    "heading": "Explore",
    "layout": "grid",
    "source": { "kind": "collection", "entity_type": "page", "sort": "natural", "page_size": 12 }
  }
}
```

### contact_form
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "attrs"],
  "properties": {
    "type": { "const": "contact_form" },
    "attrs": {
      "type": "object",
      "additionalProperties": false,
      "required": ["action_url", "fields"],
      "properties": {
        "heading": { "$ref": "#/$defs/heading", "default": "" },
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
  }
}
```

### embed
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["type", "attrs"],
  "properties": {
    "type": { "const": "embed" },
    "attrs": {
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
  }
}
```

## Shared definitions

Every served schema has exactly this `$defs` object. The first five are plain values; the rest are the Tiptap rich text nodes and marks.
```json
{
  "url": { "type": "string", "maxLength": 2048, "pattern": "^https://[^\\s]+$" },
  "link": { "type": "string", "maxLength": 2048, "pattern": "^(https://[^\\s]+|mailto:[^\\s]+|/(?:[a-z0-9-]+(?:/[a-z0-9-]+)*)?)$" },
  "heading": { "type": "string", "maxLength": 120 },
  "image": {
    "type": "object",
    "additionalProperties": false,
    "required": ["url", "alt"],
    "properties": {
      "url": { "$ref": "#/$defs/url" },
      "alt": { "type": "string", "maxLength": 200 }
    }
  },
  "action": {
    "type": "object",
    "additionalProperties": false,
    "required": ["label", "href"],
    "properties": {
      "label": { "type": "string", "minLength": 1, "maxLength": 30 },
      "href": { "$ref": "#/$defs/link" }
    }
  },
  "paragraph": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type"],
    "properties": {
      "type": { "const": "paragraph" },
      "content": { "$ref": "#/$defs/inline_content" }
    }
  },
  "heading_node": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "attrs"],
    "properties": {
      "type": { "const": "heading" },
      "attrs": {
        "type": "object",
        "additionalProperties": false,
        "required": ["level"],
        "properties": { "level": { "enum": [2, 3] } }
      },
      "content": { "$ref": "#/$defs/inline_content" }
    }
  },
  "bullet_list": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "content"],
    "properties": {
      "type": { "const": "bulletList" },
      "content": { "type": "array", "minItems": 1, "maxItems": 100, "items": { "$ref": "#/$defs/list_item" } }
    }
  },
  "ordered_list": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "content"],
    "properties": {
      "type": { "const": "orderedList" },
      "attrs": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "start": { "type": "integer", "minimum": 1, "maximum": 9999, "default": 1 },
          "type": { "type": ["string", "null"], "maxLength": 10, "default": null }
        }
      },
      "content": { "type": "array", "minItems": 1, "maxItems": 100, "items": { "$ref": "#/$defs/list_item" } }
    }
  },
  "list_item": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "content"],
    "properties": {
      "type": { "const": "listItem" },
      "content": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "oneOf": [
            { "$ref": "#/$defs/paragraph" },
            { "$ref": "#/$defs/bullet_list" },
            { "$ref": "#/$defs/ordered_list" }
          ]
        }
      }
    }
  },
  "inline_content": {
    "type": "array",
    "maxItems": 500,
    "items": { "oneOf": [{ "$ref": "#/$defs/text" }, { "$ref": "#/$defs/hard_break" }] }
  },
  "text": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "text"],
    "properties": {
      "type": { "const": "text" },
      "text": { "type": "string", "minLength": 1, "maxLength": 10000 },
      "marks": {
        "type": "array",
        "minItems": 1,
        "maxItems": 3,
        "items": {
          "oneOf": [
            { "$ref": "#/$defs/bold" },
            { "$ref": "#/$defs/italic" },
            { "$ref": "#/$defs/link_mark" }
          ]
        }
      }
    }
  },
  "hard_break": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type"],
    "properties": { "type": { "const": "hardBreak" } }
  },
  "bold": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type"],
    "properties": { "type": { "const": "bold" } }
  },
  "italic": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type"],
    "properties": { "type": { "const": "italic" } }
  },
  "link_mark": {
    "type": "object",
    "additionalProperties": false,
    "required": ["type", "attrs"],
    "properties": {
      "type": { "const": "link" },
      "attrs": {
        "type": "object",
        "additionalProperties": false,
        "required": ["href"],
        "properties": {
          "href": { "$ref": "#/$defs/link" },
          "target": { "type": ["string", "null"], "maxLength": 20, "default": null },
          "rel": { "type": ["string", "null"], "maxLength": 100, "default": null },
          "class": { "type": ["string", "null"], "maxLength": 100, "default": null }
        }
      }
    }
  }
}
```

## Rules

### The registry
- The set of block types is fixed in code: exactly the seven above. There is no endpoint to add, change or remove a block type.
- `type` is the stable key that blocks refer to (API-004) and the Tiptap node name. It is `snake_case` and never changes. It is never one of Tiptap's own node names (`doc`, `text`, `paragraph`, …), which is why the text block is `rich_text`.
- `version` is an integer, 1 for every type in this spec. Any change to a schema raises that type's `version` and needs a new version of this spec. A change that would make stored blocks invalid also needs its own story with a data migration.
- The response is the same for every owner and changes only when the code is deployed.
- The same registry, with the same schemas, is offered to other modules through `Hivesite.Content.Contracts`, so Rendering can rely on validated data without validating it again.

### Schemas
- JSON Schema draft 2020-12. Keywords used: `type`, `const`, `enum`, `oneOf`, `required`, `properties`, `additionalProperties`, `items`, `minItems`, `maxItems`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`, `default`, `$ref`, `$defs`. No others, so any 2020-12 validator gives the same result.
- `additionalProperties` is `false` on every object: unknown fields are rejected.
- Every `oneOf` has branches that cannot both match (they differ in a `const`, or one is `null`), so a value matches exactly one branch.
- `maxLength` and `minLength` count Unicode code points, as JSON Schema defines and as API-001 does.
- `default` says what API-004 stores when an attribute is left out, at any depth, including inside the matched `oneOf` branch and inside array items. Every block attribute has a `default` or is required, so stored blocks always carry every attribute.
- In rich text nodes, `content` and `marks` are left out when empty, as Tiptap does; `paragraph` and `heading` may be empty.

### Card list sources
- `source.kind` `"manual"`: the owner writes 1 to 12 cards. Each card has a `title`, a plain-text `body`, an optional `image` and an optional `action` (a label and a link).
- `source.kind` `"collection"`: the cards come from a collection of entities of `entity_type`, looked up when the page is rendered, not stored in the block. Renaming or adding an entity changes the list in the next render.
- An entity type fills the same four card slots a manual card has: `title`, `body`, `image`, and a link. Version 1 has one entity type:
  - `page`: the pages of the block's own site (API-002), except the page that holds the block. `title` is the page title, the link is the page path (`/` for the home page, `/{slug}` otherwise), `body` is `""` and `image` is `null`.
- `sort`: `natural` is the entity type's own order (`menu_order` for pages); `newest` is `created_at` descending; `title` is title ascending by Unicode code point, case-insensitive. Ties are broken by `id` ascending.
- `page_size` is the number of cards on one page of the list, 1 to 50. When the collection has more, the list is paged. How later pages are reached (their URLs and the links between them) belongs to the Rendering and Publishing specs; Content stores and validates the binding only.
- Adding an entity type later adds a value to the `entity_type` enum and raises `card_list`'s `version`. Stored blocks stay valid, so no migration is needed. Owner-defined entity types are not in this version; they are a follow-up story and will plug in here.

### Rules beyond the schemas
API-004 also checks these, with the same error as a schema failure:
- `url` and `link` targets: `https://` URLs must have a host. Site paths (`/` or `/about`) are not checked against existing pages, because pages can be renamed later.
- `contact_form.attrs.fields[].name` must be unique within the form.
- `embed.attrs.url` must belong to its `provider`:
  - `youtube`: host `www.youtube.com`, `youtube.com` or `youtu.be`
  - `vimeo`: host `vimeo.com` or `player.vimeo.com`
  - `google_maps`: host `www.google.com` and a path starting with `/maps/embed`
- Rich text in one `rich_text` block: at most 10,000 code points of text in total, summed over all `text` nodes.
- Lists nest at most 3 levels deep (a list inside a list inside a list).
- The first child of a `listItem` is a `paragraph`.
- A `text` node has each mark type at most once.
- Rich text is never HTML. A `text` node's `text` is literal: `<b>` is shown as the characters `<b>`. Rendering escapes it.
- Of the `link` mark's attributes, only `href` is used. `target`, `rel` and `class` are accepted because Tiptap's Link extension emits them, stored as sent and ignored by Rendering, which sets its own. The same holds for `orderedList`'s `type`.

## Decisions
- **Images are external `https://` URLs.** The MVP has no asset upload. Uploads come with their own story and endpoint.
- **Contact forms post to an external `action_url`**, for example a form service. Published sites stay static and Hivesite stores no submissions.
- **The embed allowlist is YouTube, Vimeo and Google Maps** for the MVP. Adding a provider raises `embed`'s `version`.

## Open questions
- none

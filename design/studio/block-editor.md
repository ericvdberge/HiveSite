# Block editor

The screen where an owner edits the blocks of one page: the ordered block list (add, reorder, remove) and one form per block type. Covers issue 119. Block types and their schemas are in API-003, the blocks document, its limits and errors in API-004. Reordering builds on [menu-reorder.md](menu-reorder.md), removing on [delete-confirm.md](delete-confirm.md). Shared rules are in [shell.md](shell.md); this note lists only what differs.

The editor form is not the rendered block. How a block looks on the published site is in `design/blocks/`; here every block is a panel of labelled fields. There is no visual (WYSIWYG) preview.

## Data

Route: `/pages/{id}/blocks`. The nav marks "Pages" as current. Owners reach it from the "Edit blocks" row action on the page list ([page-list.md](page-list.md)) and the "Edit blocks" link on the page form in edit mode ([page-form.md](page-form.md)).

On open, three calls at once, then one more:

| Call | Gives | Used for |
|---|---|---|
| GET `/pages/{id}/blocks` | The blocks document and its `ETag` | The block list; `If-Match` on save |
| GET `/pages/{id}` | page `title` (1 to 80 code points), `site_id` | The `<h1>`, the document title, the leave link |
| GET `/block-types` | `type`, `name`, `description`, `version` of all seven types (one page at the default `limit`; `next_cursor` is followed if it is not `null`) | Names in the block headers and in the Add block dialog |
| then GET `/sites/{site_id}` | site `name` | Eyebrow and nav group label |

The screen shows only when the first three have answered, because the list needs both the document and the type names.

**Editing is local.** Adding, changing, moving and removing blocks change a working copy in the studio. Nothing is sent until the owner presses "Save blocks". The working copy also keeps values that are never sent, so a choice can be undone without retyping: the fields of an unchecked optional object and the fields of the card list source not chosen.

**The document to send.** Built from the working copy by one rule, and the only thing the studio sends, measures or compares:
- `{ "type": "doc", "content": [ … ] }` with every block in the order the list shows.
- Plain strings trimmed.
- An unchecked optional object (`image`, `cta`, a card's `image` or `action`) as `null`; its kept fields are left out.
- For `card_list`, only the chosen `source` branch.
- Every `alt` always present, as `""` when empty (it is required in `$defs/image` and in gallery items).
- Rich text `content` as Tiptap emits it; an unsupported block (Versions) exactly as it was loaded.

Two documents are equal when they hold the same keys and values; key order does not count.

**Save.** PUT `/pages/{id}/blocks` with `Content-Type: application/json`, `If-Match` set to the last `ETag`, and the document to send as the body. On 200 the working copy becomes the response document (defaults filled in) and its `ETag` the new one. When the document to send equals the last saved document, no call is made and the status line says "No changes to save." PATCH is not used.

**Unsaved changes.** The screen has unsaved changes while the document to send differs from the last saved document. That drives the status line and the leave guard. Checking an optional object and unchecking it again, or moving a block away and back, leaves nothing unsaved.

**Overwrite.** Only from the changed-elsewhere dialog (412 below): the same PUT without `If-Match`, so the owner's copy replaces what is stored.

**Versions.** The forms below are written for `version` 1 of each type. If GET `/block-types` reports another version for a type, the Add block dialog leaves that type out, and blocks of that type show as read-only (see States, Unsupported block). They are sent back unchanged.

**Count.** "n of 40 blocks", where n is the number of blocks in the working copy.

**Size.** The studio measures the document to send as compact UTF-8 JSON, the same measure as the server. From 200 KB it shows "Page size: 231 of 256 KB" under the count. Over 256 KB (262,144 bytes) Save makes no call and shows the size form message.

### Field controls by schema type

Each attribute in API-003 gets the control for its schema type. Every control follows the shell field rule (label, hint, counter, error).

| Schema type | Control | Counter | Notes |
|---|---|---|---|
| `string` with `maxLength` up to 120 | text input | "n of max" | `minLength` 1 makes it required: "(required)" in the label. |
| `string` with `maxLength` above 120 | `textarea`, `rows="3"` | "n of max" | `resize: vertical`. |
| `$defs/url` | `input type="url"`, `inputmode="url"`, `autocapitalize="none"`, `spellcheck="false"` | "n of 2048" | Hint: "Starts with https://." |
| `$defs/link` | text input, `inputmode="url"`, `autocapitalize="none"`, `spellcheck="false"` | "n of 2048" | Hint: "A page path such as /about, an address starting with https://, or mailto: and an email address." `type="url"` would refuse paths. |
| `$defs/image` (object) | `fieldset` with a `legend`, holding URL (`$defs/url`, required, sent as `url`) and Alt text (string, 200, `textarea`, sent as `alt`) | per field | `alt` is always sent, as `""` when empty. Alt hint: "Describe the image for people who can't see it. Leave empty if it is only decoration." |
| `$defs/action` (object) | `fieldset` with Label (string 1 to 30, required, sent as `label`) and Link (`$defs/link`, required, sent as `href`) | per field | |
| `oneOf` with `null` (optional object) | a checkbox that shows or hides the object's `fieldset` | | Unchecked sends `null` (see The document to send). Unchecking keeps the typed values until the screen closes, so checking again restores them. |
| `enum` of up to 4 values, at block level | radio group in a `fieldset` | | Each option has a word label, never the raw value. |
| `enum` inside a repeated item | `select` | | Keeps each item short. |
| `enum` with one value (`entity_type`) | no control; read-only text | | Sent as its one value. |
| `integer` with a range of up to 3 values | radio group | | `columns` 2 to 4. |
| `integer` with a wider range | `input type="number"`, `inputmode="numeric"`, `step="1"`, `min`, `max` | | Hint states the range in words. |
| `boolean` | checkbox | | |
| `oneOf` with a `const` discriminator (`card_list` `source`) | radio group that switches between two `fieldset`s | | Only the chosen branch is sent (see The document to send). The other branch's values stay until the screen closes. |
| `array` of objects | repeated group (see Layout) | "n of max" in the group head | Add, Move up, Move down, Remove per item. |
| rich text `content` | rich text field (see Layout) | "n of 10,000" characters | Tiptap with StarterKit and Link, everything else off (API-003). |

A field whose schema has a `default` starts with it on a new block. Required fields without a `default` start empty, so a new block is invalid until the owner fills them; the client checks catch that before any call. One exception: a new contact form field's Kind starts on Short text (`text`), because a `select` has no empty choice.

### Forms by block type

Field order is the order below. "Label" is the visible label; "Sent as" is the path inside the block node.

#### Hero (`hero`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Title | text input, required | `attrs.title` | 1 to 80 |
| Subtitle | `textarea` | `attrs.subtitle` | 0 to 160, default `""` |
| Show an image | checkbox, then the image `fieldset` | `attrs.image` | `null` or URL plus alt up to 200 |
| Show a button | checkbox, then the action `fieldset` (Button label, Link) | `attrs.cta` | `null` or label 1 to 30 plus link |

Title hint: "The page's main heading. Only the hero has one."

#### Rich text (`rich_text`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Text | rich text field | `content` | 1 to 200 top-level nodes; at most 10,000 characters of text in total |

A new rich text block starts with one empty paragraph, which is valid.

#### Image (`image`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Image address | URL input, required | `attrs.image.url` | `https://`, up to 2048 |
| Alt text | `textarea` | `attrs.image.alt` | 0 to 200 |
| Caption | `textarea` | `attrs.caption` | 0 to 200, default `""` |
| Width | radio group: Text width, Wide, Full width | `attrs.width` | `content`, `wide`, `full`; default `content` |

The image fields sit directly in the form, not behind a checkbox: `image` is required.

#### Gallery (`gallery`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Heading | text input | `attrs.heading` | 0 to 120, default `""` |
| Columns | radio group: 2, 3, 4 | `attrs.columns` | default 3 |
| Images | repeated group "Image n": Image address (URL, required), Alt text (`textarea`), Caption (`textarea`) | `attrs.images`; per item `url`, `alt`, `caption` | 1 to 24 items; alt and caption 0 to 200 |

A new gallery starts with one empty image item. Each item always sends `url` and `alt` (`alt` as `""` when empty), because both are required.

#### Card list (`card_list`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Heading | text input | `attrs.heading` | 0 to 120, default `""` |
| Layout | radio group: Grid, List | `attrs.layout` | default `grid` |
| Cards from | radio group: Written by hand, Pages of this site | `attrs.source.kind` | `manual` or `collection` |

Written by hand (`manual`):

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Cards | repeated group "Card n": Title (text input, required), Text (`textarea`), Show an image (checkbox, image `fieldset`), Show a link (checkbox, action `fieldset`: Link label, Link) | `attrs.source.cards`; per item `title`, `body`, `image` (`url`, `alt`), `action` (`label`, `href`) | 1 to 12 items; title 1 to 80, text 0 to 300 |

Pages of this site (`collection`):

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| (read-only line) "Shows the pages of this site, except this one." | none | `attrs.source.entity_type` `page` | |
| Order | radio group: Menu order, Newest first, Title A to Z | `attrs.source.sort` | `natural`, `newest`, `title`; default `natural` |
| Cards per page | number input | `attrs.source.page_size` | 1 to 50, default 12 |

In a card, Text is sent as `body`, Show an image as `image` and Show a link as `action`; in the action `fieldset`, Link label is sent as `label` and Link as `href`. Unchecked, `image` and `action` are `null`.

A new card list starts on Written by hand with one empty card. Cards per page hint: "A whole number from 1 to 50. More pages follow when the site has more."

#### Contact form (`contact_form`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Heading | text input | `attrs.heading` | 0 to 120, default `""` |
| Intro | `textarea` | `attrs.intro` | 0 to 300, default `""` |
| Send to | URL input, required | `attrs.action_url` | `https://`, up to 2048 |
| Fields | repeated group "Field n": Label (text input, required), Name (text input, required), Kind (`select`: Short text, Email, Phone, Long text; required, starts on Short text), Visitors must fill this in (checkbox) | `attrs.fields`; per item `label`, `name`, `kind`, `required` | 1 to 10 items; label 1 to 60; name pattern, unique; kind `text`, `email`, `phone`, `textarea`; required default `false` |
| Button label | text input, required | `attrs.submit_label` | 1 to 30, default "Send" |

Send to hint: "The https:// address of your form service. Hivesite doesn't store messages."

**Name pattern in words.** A lowercase letter first, then lowercase letters, digits and underscores, 40 characters at most. Each name is used once per form. Name has `autocapitalize="none"` and `spellcheck="false"`.

**Name suggestion.** While the owner has not typed in Name, it follows Label: lowercase, accents dropped, every run of other characters turned into one underscore, underscores trimmed from both ends, cut to 40. A result that does not start with a letter gets `field_` in front. Typing in Name stops it; clearing Name starts it again.

A new contact form starts with one field item: Label and Name empty, Kind Short text (`text`), the checkbox unchecked.

#### Embed (`embed`)

| Label | Control | Sent as | Limit (API-003) |
|---|---|---|---|
| Provider | radio group: YouTube, Vimeo, Google Maps; required, none chosen on a new block | `attrs.provider` | `youtube`, `vimeo`, `google_maps` |
| Address | URL input, required | `attrs.url` | `https://`, up to 2048, host of the provider |
| Title | text input, required | `attrs.title` | 1 to 120 |
| Shape | radio group: Wide (16:9), Classic (4:3), Square (1:1) | `attrs.aspect_ratio` | default `16:9` |

Address hint, by provider: YouTube "A youtube.com or youtu.be address." Vimeo "A vimeo.com address." Google Maps "In Google Maps choose Share, then Embed a map, and copy the address that starts with https://www.google.com/maps/embed." Before a provider is chosen: "Choose a provider first." Title hint: "Says what the video or map shows, for people using a screen reader."

### Errors

Client checks run on blur after typing, and on every block when the owner presses "Save blocks". Lengths count code points after trimming. Their copy:

| Rule broken | Copy |
|---|---|
| required string empty after trimming | Enter a {label in lower case}. ("Enter a title.") |
| over `maxLength` | Use {max} characters or fewer. |
| `$defs/url` pattern or no host | Use an address that starts with https://, with no spaces. |
| `$defs/link` pattern or no host | Use a page path such as /about, an address that starts with https://, or a mailto: address. |
| contact field name pattern | Start with a lowercase letter, then use lowercase letters, digits and underscores, 40 at most. |
| contact field name used twice | Another field in this form already uses this name. |
| contact field kind missing or not one of the four (only from a stored document; a new field starts on Short text) | Choose a kind. |
| embed provider not chosen | Choose a provider. |
| embed address not of its provider | Use a YouTube address. / Use a Vimeo address. / Use a Google Maps embed address. |
| cards per page outside 1 to 50 or not whole | Use a whole number from 1 to 50. |
| rich text over 10,000 characters | Use 10,000 characters or fewer in this block. |
| rich text over 200 paragraphs, headings and lists | Use 200 paragraphs, headings and lists or fewer. Split the text into two blocks. |
| a list over 100 items | Use 100 items or fewer in one list. |
| page over 256 KB | form message: This page is too large to save. Remove a block or shorten some text. |
| over 40 blocks | Cannot happen: Add block is unavailable at 40. |

Array minimums (1 image, 1 card, 1 field) and maximums (24, 12, 10) never become errors: Remove is unavailable at the minimum and Add at the maximum, each with its reason.

**Save with client errors.** No call. Every invalid block opens, the form message lists them ("Error: 2 blocks need attention: 1. Hero, 4. Gallery.", each a link that focuses that block's first invalid field), and focus moves to the first invalid field.

Server errors from PUT `/pages/{id}/blocks` and the two GETs. `error.message` is never shown (shell Data); the studio uses its own copy.

| Code | Status | Where | Copy |
|---|---|---|---|
| `invalid_block` with a `field` the studio can place (`/content/{i}/attrs/…`) | 400 | That field in block i+1; the block opens | The field's client copy for the rule it breaks. When the studio's own check passes, "This value wasn't accepted. Please check it." |
| `invalid_block` inside rich text (`/content/{i}/content/…`) | 400 | The Text field of block i+1 | This text wasn't accepted. Check its links and lists. |
| `invalid_block` with a `field` the studio cannot place | 400 | Block message on block i+1, or form message without a block | This block wasn't accepted. Please check its fields. |
| `unknown_block_type` | 400 | Block message on the block its `field` names | This block type can't be saved here. Remove the block to save the page. |
| `too_many_blocks` | 400 | form message | A page holds 40 blocks at most. Remove one to save. |
| `invalid_request` | 400 | form message | Something on this page wasn't accepted. Please check it and try again. |
| `precondition_failed` | 412 | Changed-elsewhere dialog (Layout) | |
| `request_too_large` | 413 | form message | This page is too large to save. Remove a block or shorten some text. |
| `unsupported_media_type` | 415 | Cannot happen: the editor always sends `application/json`. If it does, the error toast. | |
| `page_not_found` | 404 | Not-found screen, page variant, with "Back to pages" when the site is known ([shell.md](shell.md#not-found-screen)) | |
| `unauthenticated` | 401 | Sign-in (#45), as in the shell | |
| `invalid_patch`, `patch_test_failed`, `too_many_operations`, `document_too_large`, `precondition_required` | 400, 428 | Cannot happen: they belong to PATCH, which the editor does not send. If one arrives, the error toast. | |
| `invalid_request`, `invalid_cursor` from GET `/block-types` | 400 | Cannot happen: the studio sends no `limit` and only a `next_cursor` it was given. If it does, the load error. | |
| network or server failure on save | | Error toast | We couldn't save the blocks. Your changes are still here. |
| network or server failure on load | | Load error (States) | |

`field` is a JSON Pointer into the sent document. Block i+1 is the block at position `i` of `content`, shown as number i+1. Items inside a block map the same way: `/content/3/attrs/images/2/alt` is Alt text of Image 3 in block 4.

## Structure

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <p class="hs-eyebrow">Atelier Noor</p>
    <h1 tabindex="-1">Blocks of About</h1>
    <p class="hs-count" id="block-count">5 of 40 blocks</p>
    <p class="hs-count" id="page-size">Page size: 231 of 256 KB</p>   <!-- from 200 KB only -->
    <div class="hs-screen-head__actions">
      <a class="hs-button hs-button--secondary" href="/sites/{id}/pages">Back to pages</a>
      <button type="submit" form="blocks" class="hs-button">Save blocks</button>
      <p class="hs-form__status" role="status">Unsaved changes</p>
    </div>
  </header>
  <form id="blocks" class="hs-form hs-blocks" novalidate aria-labelledby="…h1…">
    <div class="hs-message" role="alert">…</div>              <!-- only for a message without a field -->
    <p id="reorder-help" class="hs-vh">Press Space to pick up the block. Use the up and down arrow keys to move it, Space to drop it, Escape to cancel.</p>
    <p class="hs-list-status" role="status"></p>
    <ol class="hs-block-list" aria-busy="false">
      <li class="hs-block" data-reorder="rest" aria-labelledby="b1-name">
        <div class="hs-block__head">
          <button type="button" class="hs-handle" aria-describedby="reorder-help" aria-pressed="false">
            <span aria-hidden="true">⠿</span>
            <span class="hs-vh">Reorder block 1, Hero, position 1 of 5</span>
          </button>
          <h2 class="hs-block__title">
            <button type="button" class="hs-block__toggle" aria-expanded="true" aria-controls="b1-body" id="b1-name">
              <span class="hs-block__pos">1</span> Hero
            </button>
          </h2>
          <p class="hs-block__summary">Made slowly, by hand</p>
          <p class="hs-block__flag">Error: needs attention</p>   <!-- only when the block has errors -->
          <div class="hs-block__actions">
            <button type="button" class="hs-button hs-button--quiet" aria-label="Move block 1, Hero, up"><span aria-hidden="true">↑</span></button>
            <button type="button" class="hs-button hs-button--quiet" aria-label="Move block 1, Hero, down"><span aria-hidden="true">↓</span></button>
            <button type="button" class="hs-button hs-button--quiet" aria-label="Remove block 1, Hero">Remove</button>
          </div>
        </div>
        <div class="hs-block__body" id="b1-body">
          <div class="hs-message hs-message--block" role="alert">…</div>   <!-- only for a block message -->
          <div class="hs-field">Title …</div>
          <div class="hs-field">Subtitle …</div>
          <fieldset class="hs-optional">
            <legend class="hs-vh">Image</legend>
            <label><input type="checkbox" aria-controls="b1-image"> Show an image</label>
            <div id="b1-image" hidden>Image address …, Alt text …</div>
          </fieldset>
          …
        </div>
      </li>
      …
    </ol>
    <div class="hs-blocks__end">
      <button type="button" class="hs-button hs-button--secondary">Add block</button>
      <p class="hs-unavailable" id="add-reason" hidden>A page holds 40 blocks at most.</p>
    </div>
  </form>
</main>
```

Repeated group (gallery images, cards, contact fields):

```html
<fieldset class="hs-repeat">
  <legend>Images</legend>
  <p class="hs-counter" id="b4-images-count">3 of 24</p>
  <ol>
    <li>
      <fieldset class="hs-repeat__item">
        <legend>Image 1</legend>
        …fields…
        <div class="hs-repeat__actions">
          <button type="button" class="hs-button hs-button--quiet" aria-label="Move image 1 up">↑</button>
          <button type="button" class="hs-button hs-button--quiet" aria-label="Move image 1 down">↓</button>
          <button type="button" class="hs-button hs-button--quiet" aria-label="Remove image 1">Remove</button>
        </div>
      </fieldset>
    </li>
  </ol>
  <button type="button" class="hs-button hs-button--secondary">Add image</button>
</fieldset>
```

Rich text field:

```html
<div class="hs-field hs-rich">
  <p class="hs-field__label" id="b2-text-label">Text</p>
  <p class="hs-field__hint" id="b2-text-hint">Headings, paragraphs and lists, with bold, italic and links.</p>
  <div role="toolbar" aria-label="Text format" aria-controls="b2-text">
    <button type="button" aria-pressed="true">Paragraph</button>
    <button type="button" aria-pressed="false">Heading</button>
    <button type="button" aria-pressed="false">Subheading</button>
    <button type="button" aria-pressed="false">Bold</button>
    <button type="button" aria-pressed="false">Italic</button>
    <button type="button">Link</button>
    <button type="button" aria-pressed="false">Bulleted list</button>
    <button type="button" aria-pressed="false">Numbered list</button>
    <button type="button">Indent</button>
    <button type="button">Outdent</button>
  </div>
  <div id="b2-text" class="hs-rich__area" role="textbox" aria-multiline="true"
       aria-labelledby="b2-text-label" aria-describedby="b2-text-hint b2-text-count b2-text-error" contenteditable="true">…</div>
  <div class="hs-field__foot">…error… <p class="hs-counter" id="b2-text-count">1,240 of 10,000</p></div>
</div>
```

Add block dialog (shell dialog):

```html
<dialog class="hs-dialog" aria-labelledby="add-title">
  <h2 id="add-title">Add a block</h2>
  <form method="dialog">
    <fieldset>
      <legend>Block type</legend>
      <label class="hs-choice"><input type="radio" name="type" value="hero"> <span>Hero</span> <span class="hs-choice__desc">A large opening section with a title, an optional image and one call to action.</span></label>
      …six more…
    </fieldset>
    <div class="hs-field">
      <label for="add-place">Place</label>
      <select id="add-place">At the end / At the start / After 1. Hero / …</select>
    </div>
    <div class="hs-dialog__actions">
      <button type="button" class="hs-button hs-button--secondary">Cancel</button>
      <button type="submit" class="hs-button">Add block</button>
    </div>
  </form>
</dialog>
```

`hs-vh` is the visually hidden pattern from menu-reorder.md.

## Layout

The block list sits in a column of `layout.content_width`, under the screen head. Text in it never runs wider than `layout.measure`.

**Screen head.** Shell screen head. The count and the page size line use the shell count look. Actions: "Back to pages" (secondary), then "Save blocks" (primary, the screen's one primary button), then the status line (`font_size.body_s`, `color.text_muted`): empty when saved, "Unsaved changes" while the document to send differs from the last saved one (Data), "Saving…" while sending, "Blocks saved." after a save, "No changes to save." after a save with nothing changed. The words carry the state, not a color.

**Save shortcut.** Ctrl+S (Cmd+S on Mac) anywhere on the screen presses "Save blocks". The head scrolls with the page; a sticky save bar needs a stacking token (see Token gaps in shell.md).

### Block list

- An ordered list of block panels, `space.4` apart. Each panel: background `color.surface`, `border_width.hairline` solid `color.border`, `radius.card`.
- **Head.** A row, `padding-inline: space.4`, `padding-block: space.3`, items `space.3` apart: handle, title, summary, flag, actions at the end.
- **Handle.** As in menu-reorder.md: a square quiet button, `control.min_height` on each side, a grip glyph at `font_size.body` in `color.text_muted`, `touch-action: none` on the handle only.
- **Title.** An `<h2>` holding a toggle button, at least `control.min_height` tall. The position number in label style (`font.label`, `font_size.label`, `font_weight.label`, `letter_spacing.label`) in `color.accent_text`, `space.2` before the block name. The name in `font.text`, `font_size.body`, `font_weight.text_strong`, `color.text`. The `<h2>` keeps the type size of the toggle, not the shell section heading size, so 40 heads stay calm.
- **Toggle.** Opens and closes the block body (`aria-expanded`). A chevron glyph after the name, `color.text_muted`, `aria-hidden="true"`, turned when open. Hover: the name gains an underline.
- **Summary.** One line of what the block holds, `font_size.body_s`, `color.text_muted`, at most two lines, clipped with an ellipsis (the one place the studio cuts text; the full text is in the form). By type: hero `title`; rich text the first heading or paragraph text; image the alt text, else the caption, else "No alt text"; gallery the heading, then "6 images"; card list the heading, then "3 cards" or "Pages of this site, newest first"; contact form the heading, then "4 fields"; embed the title, then the provider name. An empty block reads "Not filled in yet".
- **Flag.** When the block has an error, "Error: needs attention" in `color.error`, `font_size.body_s`, "Error:" in `font_weight.text_strong`. It shows on the closed head too, so a collapsed block never hides a problem.
- **Actions.** Move up, Move down, Remove as quiet buttons (Remove has a word label). The first block's Move up and the last block's Move down are unavailable with "Already first" and "Already last".
- **Body.** Under the head, `padding-inline: space.4`, `padding-block-end: space.5`, a top edge of `border_width.hairline` solid `color.border`, then the fields per the shell field rule, `space.5` apart. Inputs on `color.surface_sunk` inside the `color.surface` panel.
- **Open or closed.** On open, every block is closed when the page has more than three blocks, else every block is open. A new block opens. Opening one block does not close others.
- **Block message.** A shell form message at the top of the body, for an error on the block that no field owns.

**Empty state.** With no blocks: in place of the list, a panel of `color.surface`, `border_width.hairline` solid `color.border`, `radius.card`, padding `space.6`: "This page has no blocks yet." in `font_size.body_l`, `color.text`, then "Add a hero to open the page, then text, images or a form." in `color.text_muted`, `space.3` above, then "Add a block" (secondary), `space.5` above. An empty page is valid and can be saved.

**End of the list.** "Add block" (secondary), `space.5` below the last panel. At 40 blocks it is unavailable with "A page holds 40 blocks at most." next to it.

### Add block dialog

- Shell dialog. Title "Add a block".
- **Block type.** A radio group of the seven types in API-003 order, one choice per row, `space.2` apart. Each choice: the radio, the `name` in `font_weight.text_strong`, `color.text`, and the `description` under it in `font_size.body_s`, `color.text_muted`. The row is at least `control.min_height` tall with padding `space.3`, an edge of `border_width.hairline` solid `color.border`, `radius.control`. Checked: the edge becomes `border_width.focus` solid `color.accent` (see Token gaps), and the radio dot shows, so the choice is not marked by color alone. Hero is checked when the page has no hero, otherwise Rich text.
- **Place.** A `select`: "At the end" (default), "At the start", then "After 1. Hero", "After 2. Rich text", …. When the dialog opens from the empty state, the select is not shown.
- **Hero note.** When the page already has a hero and Hero is chosen, a Note under the radio group: "Note: This page already has a hero. Only the first hero's title becomes the page heading." A second hero is valid in API-004; the Note is a warning, not an error.
- Actions: Cancel, then "Add block" (primary).
- **After add.** The dialog closes, the new block appears at its place, open, with schema defaults; focus goes to its first field (the rich text area for rich text, Provider for embed). The list status says "Hero added at position 3 of 6. Not saved yet."

### Reorder

As menu-reorder.md, with these differences:

- A move changes the working copy only; nothing is sent. The status line says "Unsaved changes" unless the order is back to the saved one.
- While a block is picked up or dragged, its body is hidden and only its head moves, so the moving shape is one row high. The body comes back after the drop if it was open.
- Grab look: as in menu-reorder.md (`color.surface_sunk`, `border_width.hairline` solid `color.border_strong`). The position number turns `color.text_muted` while grabbed, because `color.accent_text` is not paired with `color.surface_sunk`.
- Over look: the line of `border_width.focus` solid `color.accent` in the gap between panels.
- Keys on the handle: Space or Enter picks up and drops, Arrow Up and Arrow Down move one place, Home and End move to the ends, Escape and Tab cancel.
- There is no mismatch Note and no saving state per move: conflicts surface on Save as 412.

Live-region text, through the list status line:

| Moment | Text |
|---|---|
| Picked up | Block 2, Rich text, picked up. Position 2 of 5. Use the up and down arrow keys to move, Space to drop, Escape to cancel. |
| Moved | Moved to position 3 of 5. |
| Dropped | Rich text dropped at position 3 of 5. Not saved yet. |
| Move button | Rich text moved to position 1 of 5. Not saved yet. |
| Cancelled | Move cancelled. Rich text is back at position 2 of 5. |

### Remove

"Remove" opens a shell dialog, after delete-confirm.md:

| Part | Copy |
|---|---|
| Title | Remove block 2, "Rich text"? |
| Body | This removes the block and everything in it from the page. It is gone for good when you save. |
| Secondary line (`font_size.body_s`, `color.text_muted`) | Releases you have already published keep their copy. |
| Actions | Cancel (focus on open), "Remove block" (danger) |

- An empty new block (nothing typed yet) is removed without the dialog.
- The removal is local, so there is no busy state. The status line says "Unsaved changes" and the list status "Rich text removed. Not saved yet."
- Focus on cancel: back to that block's Remove. After remove: the toggle of the block now at that position; when it was last, the new last block's toggle; when none remain, the empty state's "Add a block".

### Repeated group

- A `fieldset` with its `legend` in the shell field label look (`font.text`, `font_size.body_s`, `font_weight.text_strong`, `color.text`) and the counter "3 of 24" at the end of the legend row.
- Items are an ordered list, `space.4` apart. Each item is a `fieldset` with a `legend` ("Image 1", "Card 2", "Field 3"), padding `space.4`, an edge of `border_width.hairline` solid `color.border`, `radius.card`, on `color.surface`. Fields inside `space.4` apart.
- Item actions at the end of the item: Move up, Move down, Remove (quiet). Move buttons are the only reorder path inside a block; there is no drag inside forms. Each move keeps focus on the pressed button, which travels with the item.
- Remove takes the item out at once, without a dialog; the item is small and the save is still to come. Focus goes to the next item's first field, or the previous one's when it was last. At the minimum (one item) Remove is unavailable with "A gallery needs at least one image." / "A card list needs at least one card." / "A contact form needs at least one field."
- "Add image" / "Add card" / "Add field" (secondary) under the list, `space.4` above. It adds an empty item at the end and focuses its first field. At the maximum it is unavailable with "24 images is the most." / "12 cards is the most." / "10 fields is the most."
- The counter follows the shell limit counter rule. It never goes over, because Add stops at the maximum.

### Optional object

- A checkbox ("Show an image", "Show a button", "Show a link") at least `control.min_height` tall. Checked, the object's fields appear under it, indented by `space.4` with an inline-start edge of `border_width.hairline` solid `color.border`.

### Radio group and checkbox

- `fieldset` with its `legend` in the shell field label look. Options in a row from `breakpoint.sm`, `space.4` apart, each at least `control.min_height` tall; below it they stack.
- Native radios and checkboxes with `accent-color: color.accent`, `border_width.control` solid `color.border_strong` edges where the browser draws them. Labels `font_size.body`, `color.text`.

### Rich text field

- **Toolbar.** A row on `color.surface`, `space.1` between controls, `space.2` below it. The format buttons are square quiet buttons, `control.min_height` on each side, with word labels shown as glyphs where short ("B", "I", a link glyph, list glyphs) and the full name as their accessible name; see icon.size in Token gaps. Toggle buttons use `aria-pressed`; pressed: background `color.surface_sunk`, an edge of `border_width.hairline` solid `color.border_strong`, so the state is not color alone. The text style is three toggle buttons at the start of the toolbar, not a `select`: Paragraph, Heading (`h2`) and Subheading (`h3`). They show their words (not glyphs), each at least `control.min_height` tall with `padding-inline: control.padding_x`. The one that matches the block at the cursor has `aria-pressed="true"`; when the selection spans more than one style, none is pressed. Pressing Heading or Subheading turns the current block into it; pressing the pressed Heading or Subheading, or Paragraph, turns it back into a paragraph.
- **Area.** The shell control look (`color.surface_sunk`, `border_width.control` solid `color.border_strong`, `radius.control`, `control.padding_x`, `control.padding_y`), at least as tall as four lines of `font_size.body` at `line_height.body` (see Token gaps), growing with its content. `font.text`, `font_size.body`, `color.text`.
- **Inside the area.** Headings in `font.display`, `font_weight.display_strong`, `line_height.heading`: Heading at `font_size.display_m`, Subheading at `font_size.body_l`. Paragraphs `space.3` apart. Lists indented by `space.5`. Links in `color.text` with an underline of `border_width.hairline` (`color.accent_text` is not paired with `color.surface_sunk`). Bold in `font_weight.text_strong`.
- **Link dialog.** From the Link button or Ctrl+K (Cmd+K) with text selected: a shell dialog "Add a link" with one Link field (`$defs/link` rule), actions Cancel, "Remove link" (secondary, only when the selection is already a link), "Add link" (primary). Without a selection the Link button is unavailable with "Select text to add a link." Only `href` is set; the studio sends `target`, `rel` and `class` as Tiptap emits them.
- **Indent and Outdent.** Nest or un-nest the current list item. Indent is unavailable at the third level with "Lists go three levels deep at most." and outside a list with "Place the cursor in a list to indent." Outdent is unavailable outside a list.
- **Paste.** Pasted content keeps only the allowed nodes and marks, as the Tiptap setup does (API-003). Images and tables are dropped; a Note under the area says "Note: Some pasted formatting was removed." until the next edit.
- Counter: characters of text summed over the block, "1,240 of 10,000", per the shell limit counter.

### Changed-elsewhere dialog (412)

Shell dialog, opened when the save returns `precondition_failed`:

| Part | Copy |
|---|---|
| Title | This page changed somewhere else |
| Body | Someone saved these blocks after you opened them, perhaps in another tab. Your changes are not saved yet. |
| Actions | Cancel (focus on open; keeps editing, nothing sent), "Load the saved version" (secondary; discards your changes and loads the stored document with GET), "Save mine instead" (danger; PUT without `If-Match`, replacing what is stored) |

"Save mine instead" uses the danger look because it overwrites someone else's work; its label says what it does.

### Leaving with unsaved changes

- Any link or nav item away from the screen opens a shell dialog: title "Leave without saving?", body "Your changes to these blocks will be lost.", actions Cancel (focus on open), "Leave without saving" (danger). Escape cancels.
- Closing or reloading the tab triggers the browser's own leave prompt (`beforeunload`).
- With no unsaved changes, nothing asks.

### Load error

When any of the three opening calls fails: the shell form message "Error: We couldn't load the blocks of this page." with "Try again" (secondary) `space.4` below it. A half-loaded editor is never shown.

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | Screen head with placeholders for the eyebrow, `<h1>` and count; three panel placeholders, each one head line tall. | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty | The empty-state panel with "Add a block". Count "0 of 40 blocks". Save is available: an empty page is valid. | `color.surface`, `color.border`, `radius.card`, `font_size.body_l`, `color.text`, `color.text_muted` |
| Error on a field | Shell field error on the field; the block opens and shows its flag. From a client check or a placed `invalid_block`. | `color.error`, `font_size.body_s`, `font_weight.text_strong` |
| Error on a block | Block message at the top of the body and the flag on the head. `unknown_block_type`, or `invalid_block` the studio cannot place. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Error without a field | Form message first in the form; focus moves to it. `too_many_blocks`, `invalid_request`, `request_too_large`, the size check, the client-error summary. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached (field) | Counter at the limit stays `color.text_muted`; over it turns `color.error` with the field error. | `color.text_muted`, `color.error` |
| Limit reached (40 blocks) | Count "40 of 40 blocks"; "Add block" unavailable with its reason. | `color.text_muted`, `color.border`, `color.text` |
| Limit reached (items) | Counter "24 of 24"; Add item unavailable with its reason. At one item, Remove unavailable with its reason. | `color.text_muted`, `color.border` |
| Limit reached (size) | "Page size: 256 of 256 KB" stays `color.text_muted`; over it turns `color.error` and Save shows the size form message. | `color.text_muted`, `color.error` |
| Load error | Form message and "Try again". | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Unsaved | The document to send differs from the last saved one (Data). Status line "Unsaved changes"; the leave guard is on. | `color.text_muted`, `font_size.body_s` |
| Sending | Every field `readonly`, every handle, move, add and remove control unavailable, "Save blocks" busy ("Saving…"), `aria-busy="true"` on the list. | `color.text_muted`, `color.border` |
| Saved | Status "Blocks saved."; fields show the stored values. | `color.text_muted`, `font_size.body_s` |
| Changed elsewhere | The 412 dialog. | `color.surface`, `color.border_strong`, `radius.card`, `color.image_scrim`, `color.error` |
| Grab, over, drop | As in menu-reorder.md, with the position number in `color.text_muted`. | `color.surface_sunk`, `color.border_strong`, `border_width.focus`, `color.accent` |
| Unsupported block | A block whose type or version the studio has no form for: head as usual, body a Note "Note: This studio can't edit this block yet. It stays as it is when you save." Move and Remove still work. | `color.rule`, `color.accent_text`, `color.text` |
| Not found | `page_not_found`: shell not-found screen, page variant. | `font_size.display_l`, `font_size.body_l`, `color.text_muted` |

## Limits

- 0 to 40 blocks; the count is always shown.
- Document up to 256 KB as compact UTF-8 JSON; the size line shows from 200 KB.
- Per field, the API-003 limits in Data, each with a counter. Inputs carry no `maxlength` (shell limit counter).
- Repeated groups: 24 images, 12 cards, 10 fields; at least one of each.
- Rich text: 10,000 characters per block, 200 top-level paragraphs, headings and lists, 100 items per list, three list levels.
- Page titles up to 80 code points in the `<h1>` wrap; block summaries clip at two lines (see Token gaps).
- One save at a time; one dialog at a time.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | Screen-head actions stack at full width under the heading: "Back to pages", "Save blocks", then the status line (the same order as the DOM and the tab order). The block head wraps: handle and title on the first line, summary and flag on the second, the move and Remove buttons on a third line at the start. The move buttons are the main touch path; the handle still drags by touch. Radio options stack. Repeated item actions sit on their own line. The toolbar wraps to two lines. Dialog actions stack, Cancel first. |
| `breakpoint.sm` to `breakpoint.md` | As in Layout. |
| from `breakpoint.md` | No change; the list stays at `layout.content_width` beside the side nav, and the head actions sit at the end of the screen head. |

## Accessibility

- **`<h1>`:** "Blocks of {page title}", for example "Blocks of About". Document title "Blocks · About · Hivesite Studio". Each block's head is an `<h2>` ("1 Hero"), so the blocks can be reached by heading. Dialogs use `<h2>`.
- **Tab order.** Shell items; Back to pages, Save blocks; form message (when shown, it gets focus); then per block: handle, toggle, Move up, Move down, Remove, then the body's fields in order when open (in a repeated item: its fields, then Move up, Move down, Remove; then the Add item button); after the last block, Add block.
- **Keyboard paths.** Add: Tab to Add block, Enter, arrows in the type group, Tab to Place, Enter on "Add block". Reorder: on a handle Space, arrows (or Home, End), Space; or Enter on Move up or Move down. Remove: Enter on Remove, then Tab to "Remove block" and Enter, or Escape to cancel. Open or close a block: Enter or Space on its toggle. Save: Ctrl+S (Cmd+S), or Enter on "Save blocks". Enter in a text input does not submit the form, because a page has many blocks; it does nothing.
- **Rich text keys.** Tab leaves the area; it never indents, so focus is never trapped. Ctrl+B (Cmd+B) bold, Ctrl+I (Cmd+I) italic, Ctrl+K (Cmd+K) link, Ctrl+] and Ctrl+[ (Cmd+] and Cmd+[) indent and outdent. The toolbar is one tab stop with a roving tabindex. Every control in it is a button (the text style is three toggle buttons, not a `select`, so no control uses the arrow keys itself): Left and Right arrows move between them, Home and End go to the ends, Enter or Space presses. Change the text style: Tab to the toolbar, Left or Right to Paragraph, Heading or Subheading, Enter; then Tab returns to the area, which follows the toolbar. Pressing a toolbar button keeps focus on it.
- **Focus.** On open, the `<h1>`. After add, the new block's first field. After a save, focus stays on "Save blocks" and the status line is read. On a save with errors, the first invalid field. Remove and dialogs as in Layout.
- **Names.** The handle says the block and its place ("Reorder block 2, Rich text, position 2 of 5"); move and remove buttons say the block. Every field has a visible label; groups have a `legend`; the rich text area is labelled by its label and described by its hint, counter and error.
- **Announcements.** Moves, adds and removes through the list status line, as in Reorder. Save results through the head status line.
- **Drag is never the only way:** every move can be made with the keyboard or the move buttons (WCAG 2.5.7).
- **Focus ring.** Shared ring (`outline: border_width.focus solid color.focus`, `outline-offset: border_width.focus_offset`) on every control, including the rich text area, toolbar buttons and the handle while picked up.
- **Targets.** Every control at least `control.min_height` in both directions.
- **Color.** Pairs from the README Color roles table only: `color.text` and `color.text_muted` on `color.background`, `color.surface` and `color.surface_sunk`; `color.accent_text` on `color.background` and `color.surface` only (the position number and the Note word, never on a grabbed head or inside an input); `color.on_accent` on `color.accent`; `color.error` on the three surfaces. Errors always say "Error:" in words.

## Motion

One shape at a time, nothing faster than `motion.duration_base`.

- **Screen change.** Per the shell: the content area fades in and rises over `motion.duration_base` with `motion.easing_enter`.
- **Open and close a block.** The body, as one shape, fades in over `motion.duration_base` with `motion.easing_standard`; the blocks below move once to make room, without their own motion. Closing fades the body over `motion.duration_base`, `motion.easing_standard`.
- **Add.** After the dialog has closed, the new block fades in and rises over `motion.duration_base` with `motion.easing_enter`.
- **Reorder.** As menu-reorder.md: keyboard and button moves glide over `motion.duration_base` with `motion.easing_standard`; the pointer drag follows the pointer; the drop settles over `motion.duration_base`.
- **Remove.** After the dialog has closed, the block fades out over `motion.duration_base`, `motion.easing_standard`; then the blocks below close the gap as one shape over `motion.duration_base`. Repeated items do the same.
- **Messages.** Field errors, block and form messages, the flag and Notes fade in over `motion.duration_base` with `motion.easing_standard`, one at a time.
- **Dialogs.** Per the shell dialog.
- **Loading placeholder.** Pulses per the shell, at `motion.duration_slower`.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, every duration becomes `motion.reduced_duration` and every distance `motion.reduced_rise_distance`: blocks open, appear, move and leave at once, messages are simply there, and placeholders are static. The pointer drag still follows the pointer.

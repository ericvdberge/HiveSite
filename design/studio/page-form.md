# Page form (add and edit)

One form for adding a page and for changing its title and slug. Covers #65 and #47 AC2, AC3, AC5 and AC9. It follows [site-form.md](site-form.md) wherever this note is silent. Shared rules are in [shell.md](shell.md); this note lists only what differs.

## Data

| Field | Control | Sent as | Limit (API-002) | Counter |
|---|---|---|---|---|
| Title | text input, required | `title` | 1 to 80 code points after trimming | yes, "n of 80" |
| Slug | text input, required | `slug` | 1 to 60 code points, slug pattern, not `assets` | yes, "n of 60" |

Also read, not edited: the site `name` (eyebrow) and `slug` (path preview) from GET `/sites/{id}`; for edit, the page from GET `/pages/{id}`, whose `site_id` gives the site, and its `menu_order` (to know whether it is home) and `updated_at` (shown after a save).

**Slug pattern in words.** Lowercase letters a to z, digits and hyphens. It starts and ends with a letter or a digit. The slug `assets` is kept for the site's files.

**Add.** POST `/sites/{id}/pages` with `title` and `slug`. On 201 the studio returns to the page list, where the new page is last ([page-list.md](page-list.md), After add).

**Edit.** PATCH `/pages/{id}` with only `title` and/or `slug`, and only the ones whose trimmed value differs from the saved one. Never `menu_order`, `id`, `site_id` or a timestamp. When nothing differs, no call is made.

**Slug suggestion (add only).** Slug follows Title by the site-form rule, cut to 60. Any result of 1 character or more is used. Typing in Slug stops it; clearing Slug starts it again. A title such as "Assets" suggests `assets`, which then gets the reserved error on blur or submit, like a typed value. Edit never suggests.

### Errors

Client checks:

| Field | Rule broken | Copy |
|---|---|---|
| Title | empty after trimming | Enter a title. |
| Title | over 80 | Use 80 characters or fewer. |
| Slug | empty | Enter a slug. |
| Slug | over 60 | Use 60 characters or fewer. |
| Slug | pattern | Use lowercase letters, digits and hyphens, starting and ending with a letter or digit. |
| Slug | is `assets` | The slug assets is kept for your site's files. Please choose another. |

Server errors:

| Code | Where | Copy |
|---|---|---|
| `invalid_request` with `field` `/title` | Title | Use 1 to 80 characters. |
| `invalid_request` with `field` `/slug` | Slug | Use 1 to 60 characters: lowercase letters, digits and hyphens. |
| `invalid_request` without a `field`, or another `field` | message, no field | Something in the form wasn't accepted. Please check it and try again. |
| `slug_taken` | Slug | Another page of this site already uses this slug. Try a different one. |
| `slug_reserved` | Slug | The slug assets is kept for your site's files. Please choose another. |
| `too_many_pages` (add) | message, no field | This site has 50 pages, the most it can hold. This page wasn't added. |
| `site_not_found` (add) | Not-found screen, site variant ([shell.md](shell.md#not-found-screen)) | |
| `page_not_found` (edit) | Not-found screen, page variant, with "Back to pages" when the site is known | |
| network or server failure | Error toast: "We couldn't save the page. Your changes are still here." | |

## Structure

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <p class="hs-eyebrow">Atelier Noor</p>
    <h1 tabindex="-1">New page</h1>                         <!-- edit: Edit page -->
  </header>
  <form class="hs-form" novalidate>
    <div class="hs-message" role="alert">…</div>            <!-- only for a message without a field -->
    <div class="hs-field">Title …</div>
    <div class="hs-field">
      <label for="page-slug">Slug <span class="hs-field__req">(required)</span></label>
      <p class="hs-field__hint" id="page-slug-hint">Lowercase letters, digits and hyphens. Starts and ends with a letter or digit. Not "assets".</p>
      <input id="page-slug" name="slug" autocapitalize="none" spellcheck="false" aria-describedby="…">
      <div class="hs-field__foot">…</div>
      <p class="hs-path-preview">Public path: <span class="hs-path">/s/atelier-noor/our-work</span></p>
      <div class="hs-note" role="status">…</div>            <!-- edit, slug changed -->
    </div>
    <div class="hs-form__actions">
      <button type="submit" class="hs-button">Add page</button>          <!-- edit: Save changes -->
      <a class="hs-button hs-button--secondary" href="…/pages">Cancel</a>
      <p class="hs-form__status" role="status"></p>
    </div>
  </form>
</main>
```

## Layout

As [site-form.md](site-form.md) Layout, with these differences:

- Two fields: Title, then Slug. Title hint: "Used in the menu and as the page title."
- Path preview: "Public path: /s/{site_slug}/{page_slug}". For the home page in edit it adds a second line: "As the home page it is also served at /s/atelier-noor/."
- Cancel shows in both add and edit and returns to the page list.

**Slug warning (edit).** When the slug differs from the saved one, the Note block reads: "Note: This page's public path changes from /s/atelier-noor/about to /s/atelier-noor/about-us. Old links may stop working." For the home page it adds: "Your home page stays at /s/atelier-noor/."

**After a save (edit).** The form takes the response values; the status line says "Saved. Last updated 28 Oct 2026, 11:02." from the response's `updated_at`.

**No change (edit).** "Save changes" with nothing changed makes no call; the status line says "No changes to save."

**At the limit (add).** When the studio already knows the site has 50 pages, the form is not shown. In its place a form message: "Error: This site has 50 pages, the most it can hold. Delete one to add another." and a secondary "Back to pages".

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | Add: the site is loading; placeholders for the eyebrow and both fields. Edit: the page and its site are loading; the same placeholders. | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty (add) | Blank Title and Slug, counters "0 of 80" and "0 of 60", path preview "Public path: /s/atelier-noor/…". Edit is never empty: every page has a title and slug. | `color.surface_sunk`, `color.border_strong`, `color.text_muted` |
| Error on a field | Shell field error. `invalid_request` on the field named by `error.field`; `slug_taken` and `slug_reserved` on Slug. | `color.error`, `font_size.body_s`, `font_weight.text_strong` |
| Error without a field | Form message first in the form; focus moves to it. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached (field) | "80 of 80" or "60 of 60" stays `color.text_muted`; over it the counter turns `color.error` with the field error. | `color.text_muted`, `color.error` |
| Limit reached (50 pages, add) | Form message in place of the form, as above. A server `too_many_pages` keeps the form, shows the form message with its copy and makes "Add page" unavailable. | `color.surface`, `color.error`, `color.text_muted`, `color.border` |
| Reserved slug | Field error on Slug naming `assets`, from the client check or the server. | `color.error` |
| Sending | Fields `readonly`; button busy ("Adding…" or "Saving…"); Cancel unavailable. | `color.text_muted`, `color.border` |
| Saved (edit) | Status line with the new `updated_at`. | `color.text_muted`, `font_size.body_s` |
| Slug changed (edit) | Note block under the path preview. | `color.rule`, `color.accent_text`, `color.text`, `border_width.focus` |

## Limits

- Title 80 and slug 60 code points, each with a counter. Nothing is cut short.
- Path preview up to 105 characters; it wraps with `overflow-wrap: anywhere`.
- One request at a time.

## Responsive

As [site-form.md](site-form.md) Responsive: below `breakpoint.sm` the buttons are full width and stack, primary first; from `breakpoint.md` the column stays at `layout.content_width` beside the side nav.

## Accessibility

- **`<h1>`:** "New page" (add), "Edit page" (edit). The eyebrow gives the site name; the document title adds the page title in edit ("Edit page · About · Hivesite Studio").
- **Tab order.** Shell items, form message (when shown), Title, Slug, primary button, Cancel.
- **Keyboard paths.** Enter in a field submits. Add: fill Title (Slug follows), Enter. Edit: change a field, Enter or "Save changes". Cancel: Tab to it, Enter.
- On 201, focus goes to the new row's title link on the page list. On a save, focus stays on "Save changes" and the status line is read. Errors move focus as in site-form.
- Labels, hints, counters and errors as in site-form; Slug has `autocapitalize="none"` and `spellcheck="false"`.
- Shared focus ring (`border_width.focus`, `color.focus`); controls and buttons at least `control.min_height` tall.

## Motion

- The form follows the shell screen change: one shape, fade and rise over `motion.duration_base` with `motion.easing_enter`.
- Field errors, the form message and the slug Note fade in over `motion.duration_base` with `motion.easing_standard`, one at a time.
- Placeholders pulse per the shell loading placeholder, at `motion.duration_slower`.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. Messages are simply there and placeholders are static.

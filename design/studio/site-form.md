# Site form (create and edit)

One form for creating a site and for editing its name, slug and settings. Covers #61, #62 and #46 AC3 to AC8. Shared rules are in [shell.md](shell.md); this note lists only what differs.

## Data

| Field | Control | Sent as | Limit (API-001) | Counter |
|---|---|---|---|---|
| Name | text input, required | `name` | 1 to 80 code points after trimming | yes, "n of 80" |
| Slug | text input, required | `slug` | 3 to 40 code points, slug pattern | yes, "n of 40" |
| Language | text input, required in the form, prefilled `en` on create | `settings.language` | 2 to 35 code points, language tag pattern | yes, "n of 35" |
| Description | `textarea`, optional | `settings.description` | 0 to 160 code points | yes, "n of 160" |

Read for edit: GET `/sites/{id}` gives every field above plus `updated_at` (shown) and `id`, `created_at` (not shown).

**Slug pattern in words.** Lowercase letters a to z, digits and hyphens. It starts and ends with a letter or a digit.

**Language pattern in words.** Two or three lowercase letters, then optional parts of 2 to 8 letters or digits, each after a hyphen. For example `en`, `nl` or `pt-BR`.

**Create.** POST `/sites` with `name`, `slug` and `settings` holding `language` and `description`. On 201 the studio opens the new site's pages screen ([page-list.md](page-list.md)).

**Edit.** PATCH `/sites/{id}` with only the fields whose trimmed value differs from the saved one. `settings` holds only its changed keys, because the server merges it one level deep. When nothing differs, no call is made.

**Slug suggestion (create only).** While the owner has not typed in Slug, it follows Name: lowercase, accents dropped (é becomes e), every run of other characters turned into one hyphen, hyphens trimmed from both ends, cut to 40 and trimmed again. When the result is shorter than 3, Slug stays empty for the owner to fill. Typing in Slug stops the suggestion; clearing Slug starts it again. Edit never suggests.

### Errors

Client checks run first, with the same rules as the server. Their copy:

| Field | Rule broken | Copy |
|---|---|---|
| Name | empty after trimming | Enter a name. |
| Name | over 80 | Use 80 characters or fewer. |
| Slug | under 3 | Use at least 3 characters. |
| Slug | over 40 | Use 40 characters or fewer. |
| Slug | pattern | Use lowercase letters, digits and hyphens, starting and ending with a letter or digit. |
| Language | length or pattern | Use a language tag such as en, nl or pt-BR. |
| Description | over 160 | Use 160 characters or fewer. |

Server errors:

| Code | Where | Copy |
|---|---|---|
| `invalid_request` with `field` `/name` | Name | Use 1 to 80 characters. |
| `invalid_request` with `field` `/slug` | Slug | Use 3 to 40 characters: lowercase letters, digits and hyphens. |
| `invalid_request` with `field` `/settings/language` | Language | Use a language tag such as en, nl or pt-BR. |
| `invalid_request` with `field` `/settings/description` | Description | Use 160 characters or fewer. |
| `invalid_request` without a `field`, or a `field` the form does not have | message, no field | Something in the form wasn't accepted. Please check it and try again. |
| `slug_taken` | Slug | Another site already uses this path. Try a different slug. |
| `too_many_sites` (create) | message, no field | You have 10 sites, the most for now. This site wasn't created. |
| `site_not_found` (edit) | Not-found screen, site variant ([shell.md](shell.md#not-found-screen)) | |
| network or server failure | Error toast: "We couldn't save the site. Your changes are still here." | |

## Structure

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <p class="hs-eyebrow">Atelier Noor</p>                <!-- edit only -->
    <h1 tabindex="-1">New site</h1>                       <!-- edit: Site settings -->
    <p class="hs-lead">Last updated <time datetime="…">28 Oct 2026, 10:21</time></p>  <!-- edit only -->
  </header>
  <form class="hs-form" novalidate>
    <div class="hs-message" role="alert">…</div>          <!-- only for a message without a field -->
    <div class="hs-field">Name …</div>
    <div class="hs-field">
      <label for="site-slug">Slug <span class="hs-field__req">(required)</span></label>
      <p class="hs-field__hint" id="site-slug-hint">Lowercase letters, digits and hyphens. Starts and ends with a letter or digit.</p>
      <input id="site-slug" name="slug" autocapitalize="none" spellcheck="false" aria-describedby="…">
      <div class="hs-field__foot">…</div>
      <p class="hs-path-preview">Public path: <span class="hs-path">/s/atelier-noor</span></p>
      <div class="hs-note" role="status">…</div>          <!-- edit, slug changed -->
    </div>
    <div class="hs-field">Language …</div>
    <div class="hs-field">Description (textarea rows="3") …</div>
    <div class="hs-form__actions">
      <button type="submit" class="hs-button">Create site</button>   <!-- edit: Save changes -->
      <a class="hs-button hs-button--secondary" href="/">Cancel</a>   <!-- create only -->
      <p class="hs-form__status" role="status"></p>
    </div>
  </form>
</main>
```

`novalidate` turns off the browser's own bubbles; the studio shows its own field errors.

## Layout

- The form sits on `color.background` in a column of `layout.content_width`. No panel: the screen is the form.
- Fields per the shell field rule, `space.5` apart, in the order Name, Slug, Language, Description.
- Hints: Name "The name visitors see." Language "For example en, nl or pt-BR." Description "Shown in search results."
- Path preview under the slug field foot, `space.2` above: `font_size.body_s`, `color.text_muted`, the path in the shared path style. It follows the slug as typed; with an empty slug it reads "Public path: /s/…".
- Actions `space.6` below the last field, `space.3` apart: the primary button, then Cancel (create only), then the status line in `font_size.body_s`, `color.text_muted`.

**Slug warning (edit).** When the slug differs from the saved one, a Note block (shell field error, Note) shows under the path preview, `space.3` above: "Note: Your public path changes from /s/atelier-noor to /s/atelier-noor-ceramics. Old links may stop working." It goes away when the slug is back to the saved value. Saving does not ask again; the note is the warning.

**After a save (edit).** The form takes the values from the response. The lead line under the `<h1>` shows the response's `updated_at`, and the status line says "Saved. Last updated 28 Oct 2026, 10:21." The nav site name and the eyebrow take the new name.

**No change (edit).** Pressing "Save changes" with nothing changed makes no call. The status line says "No changes to save."

**At the limit (create).** When the studio already knows the owner has 10 sites, the form is not shown. In its place a form message: "Error: You have 10 sites, the most for now. Sites can't be deleted yet." and a secondary "Back to your sites".

## States

| State | What shows | Tokens |
|---|---|---|
| Loading (edit) | Screen head with the `<h1>`; a placeholder for each label and control, four fields. | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty (create) | Blank Name, Slug and Description, Language `en`, counters "0 of 80", "0 of 40", "2 of 35", "0 of 160". Edit is never empty: every site has a name and slug, and an empty description is a valid value. | `color.surface_sunk`, `color.border_strong`, `color.text_muted` |
| Error on a field | Shell field error on the field: border `color.error`, "Error: …" under it. Server `invalid_request` lands on the field named by `error.field`; `slug_taken` on Slug. | `color.error`, `font_size.body_s`, `font_weight.text_strong` |
| Error without a field | Form message first in the form; focus moves to it. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached (field) | Counter at "80 of 80" stays `color.text_muted`; over it, "82 of 80" turns `color.error` with the field error. | `color.text_muted`, `color.error` |
| Limit reached (10 sites, create) | Form message in place of the form, as above. A server `too_many_sites` keeps the form and shows the form message with its copy; the create button becomes unavailable. | `color.surface`, `color.error`, `color.text_muted`, `color.border` |
| Sending | Fields `readonly`; button busy ("Creating…" or "Saving…"); Cancel unavailable. | `color.text_muted`, `color.border` |
| Saved (edit) | Status line and lead line with the new `updated_at`. | `color.text_muted`, `font_size.body_s` |
| Slug changed (edit) | Note block under the path preview. | `color.rule`, `color.accent_text`, `color.text`, `border_width.focus` |

## Limits

- Name 80, slug 40, language 35, description 160 code points, each with a counter. Description is about three lines in the `textarea`.
- The form never cuts input short; it shows the count over the limit and the error.
- A long name wraps in the eyebrow and nav; nothing is cut off.
- One request at a time; the button is busy until it ends.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | The primary button and Cancel are full width and stack, primary first; the status line goes under them. The path preview and the Note wrap the paths with `overflow-wrap: anywhere`. |
| `breakpoint.sm` to `breakpoint.md` | As in Layout. |
| from `breakpoint.md` | No change to the form; the column stays at `layout.content_width` beside the side nav. |

## Accessibility

- **`<h1>`:** "New site" (create), "Site settings" (edit). The eyebrow gives the site name.
- **Tab order.** Shell items, form message (when shown, it gets focus), Name, Slug, Language, Description, primary button, Cancel (create).
- **Keyboard paths.** Enter in a text input submits the form. Create: fill the fields, Enter or the "Create site" button. Edit: change fields, Enter or "Save changes". Cancel: Tab to it, Enter.
- On a submit with errors, focus moves to the first invalid field; with a message without a field, to the message.
- On 201, focus goes to the `<h1>` of the new site's pages screen. On a save, focus stays on "Save changes" and the status line is read.
- Every control has a visible label and its hint, counter and error in `aria-describedby`. Slug and Language have `autocapitalize="none"` and `spellcheck="false"`.
- The slug Note is `role="status"`, so it is read once when it appears.
- Shared focus ring (`border_width.focus`, `color.focus`); controls and buttons at least `control.min_height` tall.

## Motion

- The form follows the shell screen change: one shape, fade and rise over `motion.duration_base` with `motion.easing_enter`.
- Field errors, the form message and the slug Note fade in over `motion.duration_base` with `motion.easing_standard`, one at a time in the order they appear. They do not slide; the fields below move once to make room.
- Placeholders pulse per the shell loading placeholder, at `motion.duration_slower`.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. Messages are simply there and placeholders are static.

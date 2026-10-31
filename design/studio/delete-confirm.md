# Delete confirm

The dialog that asks before a page is deleted, from a row's "Delete" on the page list. Covers #66 and #47 AC6. Uses the shell dialog ([shell.md](shell.md#dialog)); this note lists only what differs.

## Data

| Field | Shown as | Limit (API-002) |
|---|---|---|
| page `title` | In the dialog title and body | 1 to 80 code points |
| page `menu_order` | Picks the variant: 0 means home | 0 to 49 |
| next page `title` (the page with `menu_order` 1) | Home variant: the page that becomes home | 1 to 80 code points |
| page count | Only-page variant when it is 1 | 1 to 50 |
| page `id` | Not shown. Sent in DELETE `/pages/{id}`. | UUIDv7 |

All of it comes from the page list already loaded; opening the dialog makes no call.

| Response | What happens |
|---|---|
| 204 | The dialog closes, the row leaves the list, the rows after it move up one place and the count drops by one. No full reload: the list matches API-002 Menu (gap closed, next page home). |
| 404 `page_not_found` | The page was already gone. The dialog closes, the list reloads, and the list status says "That page was already deleted. The list is up to date." This is not the not-found screen. |
| network or server failure | The dialog stays open with a form message inside it: "Error: We couldn't delete the page. Please try again." The buttons return to idle. |

## Structure

```html
<dialog class="hs-dialog" aria-labelledby="del-title" aria-describedby="del-body">
  <h2 id="del-title">Delete "About"?</h2>
  <div id="del-body">
    <p class="hs-dialog__home">About is your home page. Our work becomes the home page.</p>  <!-- home variant -->
    <p>This deletes the page and all its blocks. It can't be undone.</p>
    <p class="hs-dialog__aside">Releases you have already published keep their copy.</p>
  </div>
  <div class="hs-message" role="alert">…</div>            <!-- only after a failed call -->
  <div class="hs-dialog__actions">
    <button type="button" class="hs-button hs-button--secondary" autofocus>Cancel</button>
    <button type="button" class="hs-button hs-button--danger">Delete page</button>
  </div>
</dialog>
```

### Copy by variant

| Variant | When | Title | Body |
|---|---|---|---|
| Page | `menu_order` is not 0 | Delete "About"? | This deletes the page and all its blocks. It can't be undone. Releases you have already published keep their copy. |
| Home | `menu_order` 0 and more pages follow | Delete "Home"? | Home is your home page. About becomes the home page. Then the Page body. |
| Only page | the site has one page | Delete "Home"? | This is the site's only page. The site will have no home page until you add one. Then the Page body. |

Titles in the copy are the page's own, inside quotes in the dialog title and plain in the body.

## Layout

- Shell dialog, `max-inline-size: layout.content_width`.
- The home or only-page line comes first in the body, `color.text`, `font_weight.text_strong`, so the handover is read before the warning.
- The permanence line in `color.text`. The releases line in `font_size.body_s`, `color.text_muted`, `space.2` above.
- A form message after a failure sits between the body and the actions, `space.4` above.
- Actions: Cancel (secondary), then "Delete page" (danger). The dialog has no primary button: the safe choice is not dressed as the main one.

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | Cannot happen: the dialog opens with data already on the page list. The in-progress state is Deleting. | |
| Empty | Cannot happen as an empty dialog: it always names a page. The nearest case, the site's last page, is the Only page variant. | |
| Error on a field | Cannot happen: the dialog has no fields. A failed call shows the form message inside the dialog. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached | Cannot happen: deleting lowers the count. At 50 pages, a delete makes "Add page" available again on the list. | |
| Open | Panel, backdrop, focus on Cancel. | `color.surface`, `color.border_strong`, `radius.card`, `space.6`, `color.image_scrim` |
| Deleting | "Delete page" busy ("Deleting…"); Cancel unavailable; Escape does nothing until the call ends. | `color.text_muted`, `color.border` |
| Already gone (404) | Dialog closes; list reloads with its loading rows; list status line. | `color.text_muted`, `font_size.body_s` |

## Limits

- Page titles up to 80 code points, in the title and the body; both wrap and are never cut off. With two long titles the home variant body is about four lines.
- One dialog at a time. A second "Delete" cannot be pressed while one is open, because the page behind is inert.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | Panel padding `space.5`; the actions stack at full width, Cancel first, "Delete page" under it. The panel keeps `layout.gutter` on both sides. |
| `breakpoint.sm` to `breakpoint.md` | As in Layout. |
| from `breakpoint.md` | No change; the panel is centered in the viewport, not in the content area. |

## Accessibility

- **`<h2>`:** "Delete "About"?" The dialog sits over the page list, whose `<h1>` "Pages" stays the screen's heading.
- **Focus on open.** Cancel (`autofocus`), the safe choice.
- **Tab order inside.** Cancel, "Delete page", then back to Cancel; the page behind is inert.
- **Keyboard paths.** Delete: Tab to "Delete page", Enter or Space. Cancel: Escape, or Enter on Cancel.
- **Focus on cancel.** Back to the "Delete" button of the same row.
- **Focus after delete.** The title link of the row that now holds the deleted row's position; when the deleted row was last, the new last row's title link; when no rows remain, the empty state's "Add a page" button. The list status says "About deleted." In the home variant: "Home deleted. About is now your home page."
- **Focus after 404.** The same rule as after delete, once the list has reloaded.
- The dialog is labelled by its title and described by its body, so the handover and the warning are read on open.
- "Delete page" is named in words; its `color.error` edge is never the only sign it deletes.
- Shared focus ring (`border_width.focus`, `color.focus`); both buttons at least `control.min_height` tall.

## Motion

- Open and close per the shell dialog: the backdrop appears at once, the panel fades and rises over `motion.duration_base` with `motion.easing_enter`, and fades out over `motion.duration_base` with `motion.easing_standard`.
- After the dialog has closed, the deleted row fades out over `motion.duration_base`, `motion.easing_standard`. Then the rows below close the gap as one shape, over `motion.duration_base`, `motion.easing_standard`. One shape at a time: the dialog, then the row, then the gap.
- In the home variant the "Home page" marker appears on the new home row with the gap move, not after it.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. The dialog is simply there, and the row is gone at once.

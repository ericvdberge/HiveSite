# Menu reorder

Changing the menu order on the page list, by drag and drop, by keyboard and by move up and down buttons. The first page is home, so a move can change the home page. Covers #67 and #47 AC7 and AC8. Builds on the rows of [page-list.md](page-list.md); shared rules are in [shell.md](shell.md). This note lists only what differs.

## Data

| Field | Use | Limit (API-002) |
|---|---|---|
| page `id` of every page, in the new order | Sent as `page_ids` in PUT `/sites/{id}/menu` | 0 to 50 entries, each page exactly once |
| page `title` | Row title and live-region text | 1 to 80 code points |
| `page_ids` in the response | The order the list shows after a save | as sent |

One completed move sends one request with the full list of ids. The list then shows the order the response echoes, which is also the new home page (the first id).

| Code | What happens |
|---|---|
| 200 | The list takes the echoed order; status "Order saved." |
| `menu_mismatch` | The pages changed elsewhere. The list reloads (page-list Data), then the mismatch Note asks the owner to try again. Nothing was changed on the server. |
| `invalid_request` | Cannot happen with a list built from the loaded pages. If it does, handled as a failure. |
| `site_not_found` | Not-found screen, site variant. |
| network or server failure | The list returns to the last saved order and the error toast says "We couldn't save the new order. Your pages are back in their last saved order." |

## Structure

The row parts this note owns:

```html
<p id="reorder-help" class="hs-vh">Press Space to pick up the page. Use the up and down arrow keys to move it, Space to drop it, Escape to cancel.</p>
<p class="hs-list-status" role="status"></p>       <!-- page-list status line, also used here -->
<div class="hs-note" role="alert">…</div>          <!-- only after menu_mismatch, above the list -->
<ol class="hs-list hs-pages" aria-busy="false">
  <li class="hs-row" data-reorder="rest">          <!-- rest | grabbed | saving -->
    <button type="button" class="hs-handle" aria-describedby="reorder-help" aria-pressed="false">
      <span aria-hidden="true">⠿</span>
      <span class="hs-vh">Reorder About, position 2 of 5</span>
    </button>
    …
    <button type="button" class="hs-button hs-button--quiet" aria-label="Move About up"><span aria-hidden="true">↑</span></button>
    <button type="button" class="hs-button hs-button--quiet" aria-label="Move About down"><span aria-hidden="true">↓</span></button>
  </li>
</ol>
```

`hs-vh` is the visually hidden pattern: present for screen readers, not drawn.

## Layout

**Handle.** A square quiet button at the start of the row, `control.min_height` on each side, a grip glyph at `font_size.body` in `color.text_muted` (see Token gaps in shell.md). `cursor: grab`; `touch-action: none` on the handle only, so the rest of the list still scrolls by touch.

**Move up and down.** Square quiet buttons in the row actions (page-list Layout). The first row's Move up and the last row's Move down are unavailable, with "Already first" or "Already last" in their description.

**Drag and drop (pointer, pen, touch).** Pointer events on the handle, so mouse, pen and touch work the same.
1. Press on the handle: the row takes the grab look.
2. Move: the row follows the pointer up and down within the list. The other rows stay where they are; the over look shows where it would land.
3. Release over the list: the row settles into the marked slot (drop look), and the order is saved.
4. Release outside the list or press Escape: the row returns to its place and nothing is sent.

**Keyboard on the handle.**

| Key | Action |
|---|---|
| Space or Enter | Pick up the row; pressed again, drop it and save. |
| Arrow Up, Arrow Down | While picked up: move one place. |
| Home, End | While picked up: move to the first or last place. |
| Escape | While picked up: put it back where it was; nothing is sent. |
| Tab, or focus leaves | While picked up: the same as Escape. |

While picked up, the row moves in the list itself, so what the owner sees is what will be saved. Focus stays on the handle as it travels.

**Move buttons.** Each press moves the row one place and saves straight away. Focus stays on the pressed button, which travels with the row.

**Looks.**

| Look | When | Drawn as |
|---|---|---|
| Grab | Row picked up by pointer or keyboard | Background `color.surface_sunk`, an edge of `border_width.hairline` solid `color.border_strong` on all sides (stand-in for elevation), handle `cursor: grabbing`, `aria-pressed="true"`. Text stays `color.text` and `color.text_muted`. |
| Over | Pointer drag, at the slot the row would land in | A line of `border_width.focus` solid `color.accent` across the list width in the gap between two rows (stand-in for an indicator width). |
| Drop | Row released | The row settles into its slot, then its background returns to `color.background`. |
| Saving | From drop until the response | Every handle and move button unavailable; `aria-busy="true"` on the list; the list status says "Saving order…". The moved row keeps its place. |

**Home marker.** It always sits on the first row. When a move changes the first row, the marker moves with the drop, not during the drag.

**Mismatch Note.** After `menu_mismatch` and the reload, a Note block (shell Note look, `role="alert"`) above the list, `space.4` below it: "Note: Your pages changed somewhere else, so we reloaded the list. Please make your move again." It stays until the next successful save or until the owner leaves the screen.

### Live-region text

Spoken through the list status line (`role="status"`).

| Moment | Text |
|---|---|
| Picked up | About picked up. Position 2 of 5. Use the up and down arrow keys to move, Space to drop, Escape to cancel. |
| Moved | Moved to position 3 of 5. |
| Moved to the top | Moved to position 1 of 5. About will become the home page. |
| Dropped | About dropped at position 3 of 5. Saving order. |
| Move button | About moved to position 1 of 5. Saving order. |
| Saved | Order saved. |
| Saved with a new home | Order saved. About is now your home page. |
| Cancelled | Move cancelled. About is back at position 2 of 5. |
| Mismatch | The Note text above, through its own `role="alert"`. |
| Failure | Order not saved. About is back at position 2 of 5. (The toast also shows.) |

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | No reorder controls until the whole page list has loaded (page-list Loading). During the mismatch reload the rows stay visible with every control unavailable and `aria-busy="true"`. | `color.text_muted`, `color.border` |
| Empty | Cannot happen: with no pages there is nothing to order, and the page-list empty state shows. With one page the controls are not shown. | |
| Error on a field | Cannot happen: reordering has no fields. Errors are about the whole list: the mismatch Note, or the toast. | `color.rule`, `color.accent_text`, `color.text`, `color.surface`, `color.error` |
| Limit reached | Cannot happen as a reorder limit: `page_ids` holds at most 50 entries, the same as the page limit. With 50 rows, Home and End and the move buttons spare long drags. | |
| Grab, over, drop | As in Looks. | `color.surface_sunk`, `color.border_strong`, `border_width.hairline`, `border_width.focus`, `color.accent`, `color.background` |
| Saving | Controls unavailable, "Saving order…". | `color.text_muted`, `color.border`, `font_size.body_s` |
| Saved | Echoed order; "Order saved." | `color.text_muted` |
| `menu_mismatch` | Reloaded list and the mismatch Note. | `color.rule`, `color.accent_text`, `color.text`, `border_width.focus` |
| Failure | Last saved order and the error toast. | `color.surface`, `color.error`, `color.text` |

## Limits

- Up to 50 rows. A drag over a long list scrolls the page when the pointer nears the top or bottom of the viewport, by the browser's own drag scrolling; the keyboard and move buttons need no scrolling.
- One save at a time: controls are unavailable until the response, so no two menu requests overlap.
- Titles up to 80 code points in the live text are read in full.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | The move buttons sit on the row's second line (page-list Responsive) and are the main touch path; the handle still drags by touch. The over line spans the full row width. |
| `breakpoint.sm` to `breakpoint.md` | As in Layout. |
| from `breakpoint.md` | No change; the list stays at `layout.content_width`. |

## Accessibility

- **`<h1>`:** "Pages", from the page list.
- **Tab order per row.** Handle, title link, Move up, Move down, Delete. While a row is picked up, Tab drops nothing: it cancels the move and moves on.
- **Keyboard paths.** Reorder by handle: Tab to the handle, Space, arrows (or Home, End), Space. Reorder by buttons: Tab to Move up or Move down, Enter or Space, once per place. Cancel: Escape.
- The handle's name says the page and its position ("Reorder About, position 2 of 5"), and `reorder-help` gives the keys.
- Every move is announced with its new position. A move that changes home says so.
- After a mismatch reload, focus goes to the moved row's handle if that page still exists, otherwise to the `<h1>`.
- Drag is never the only way: every move can be made with the keyboard or the buttons (WCAG 2.5.7).
- Shared focus ring (`border_width.focus`, `color.focus`) on the handle and the buttons, including while the row is picked up. Handle and buttons are at least `control.min_height` on each side.

## Motion

One shape at a time: only the moved row animates.

- **Keyboard and button moves.** The moved row glides to its new place over `motion.duration_base` with `motion.easing_standard`. The row it passes takes its new place without motion. A new key press during a glide starts from where the row is.
- **Pointer drag.** The row follows the pointer directly; that is the owner's hand, not an animation. The over line appears and moves without transition.
- **Drop.** The row settles from where it was released into its slot over `motion.duration_base`, `motion.easing_standard`; then its background returns to `color.background` over `motion.duration_base`.
- **Cancel and failure.** The row glides back to its saved place over `motion.duration_base`, `motion.easing_standard`.
- **Mismatch Note.** Fades in over `motion.duration_base`, `motion.easing_standard`, after the reload has finished.
- **Reduced motion.** Durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`: rows jump to their new place, the drop has no settle, and the Note is simply there. The pointer drag still follows the pointer, because that is direct movement, not animation.

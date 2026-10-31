# Page list

The main view of a site screen: every page of the site in menu order, the home marker, the 50-page limit and the empty state. Covers #64 and #47 AC1 and AC4. Reordering is in [menu-reorder.md](menu-reorder.md), delete in [delete-confirm.md](delete-confirm.md), add and edit in [page-form.md](page-form.md). Shared rules are in [shell.md](shell.md); this note lists only what differs.

## Data

GET `/sites/{id}` for the site, then GET `/sites/{id}/pages`, following `next_cursor` until it is `null` (at most 50 pages). The list shows only when every page has loaded, because the count, the home marker and the menu order need the whole set.

| Field | Shown as | Limit (API-001, API-002) |
|---|---|---|
| site `name` | Eyebrow and nav group label | 1 to 80 code points |
| site `slug` | First part of every path | 3 to 40 code points |
| page `title` | Row title, a link to the page form (edit) | 1 to 80 code points |
| page `slug` | Path `/s/{site_slug}/{page_slug}`; the home page shows `/s/{site_slug}/` | 1 to 60 code points |
| page `menu_order` | Position number ("1" for `menu_order` 0) and row order; `menu_order` 0 is home | 0 to 49 |
| page `id` | Not shown. Row links, delete and the menu request. | UUIDv7 |

`created_at`, `updated_at` and `site_id` are not shown. The order is the server's (`menu_order` ascending); the studio never sorts the list itself.

**Count.** "n of 50 pages", where n is the number of pages loaded. It is exact, because the studio loads every page.

| Code | Where |
|---|---|
| `site_not_found` | Not-found screen, site variant. |
| `invalid_cursor` | The studio reloads the list from the start once; a second failure shows the list error. |
| `invalid_request` (`limit`) | Cannot happen: the studio sends the default. If it does, the list error. |
| network or server failure on any page of the list | The list error. A half-loaded list is never shown. |
| `too_many_pages` | Shown on the add form ([page-form.md](page-form.md)). |

## Structure

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <p class="hs-eyebrow">Atelier Noor</p>
    <h1 tabindex="-1">Pages</h1>
    <p class="hs-count" id="page-count">5 of 50 pages</p>
    <div class="hs-screen-head__actions">
      <a class="hs-button" href="/sites/{id}/pages/new">Add page</a>
    </div>
  </header>
  <p class="hs-list-status" role="status"></p>          <!-- add, delete and reorder messages -->
  <ol class="hs-list hs-pages" aria-labelledby="…h1…">
    <li class="hs-row">
      <button type="button" class="hs-handle">…</button>       <!-- menu-reorder.md -->
      <span class="hs-row__pos" aria-hidden="true">1</span>
      <a class="hs-row__title" href="/pages/{id}">Home</a>
      <span class="hs-home">Home page</span>                    <!-- first row only -->
      <p class="hs-row__meta"><span class="hs-path">/s/atelier-noor/</span></p>
      <div class="hs-row__actions">
        <button type="button" class="hs-button hs-button--quiet" aria-label="Move Home up">…</button>    <!-- menu-reorder.md -->
        <button type="button" class="hs-button hs-button--quiet" aria-label="Move Home down">…</button>
        <button type="button" class="hs-button hs-button--quiet" aria-label="Delete Home">Delete</button>
      </div>
    </li>
    …
  </ol>
</main>
```

An ordered list, because the order is the menu.

## Layout

- Screen head per shell. The count sits under the `<h1>`, `space.2` above it, in the counter style.
- The list status line sits between the head and the list, `font_size.body_s`, `color.text_muted`, `space.4` below it; empty lines take no space.
- Rows follow the shared list row, inside `layout.content_width`, in a row of: handle, position, title with meta, home marker, actions. `space.3` between items.
- Position: `font.label`, `font_size.label`, `letter_spacing.body`, `color.text_muted`, at least the width of two digits so titles line up. Hidden from screen readers; the list order already says it.
- Title is the shared row title and a link to the edit form. The whole row is not linked, because the row holds several actions.
- Meta: the path in the shared path style, `space.1` below the title.
- Row actions: quiet buttons. "Delete" shows its word; move up and down are square quiet buttons with an arrow glyph at `font_size.body` (see Token gaps in shell.md) and an `aria-label` with the page title.

**Home marker.** On the row with `menu_order` 0, after the title: the words "Home page" in label style (`font.label`, `font_size.label`, `font_weight.label`, `letter_spacing.label`, uppercase), `color.text`, inside an edge of `border_width.hairline` solid `color.border_strong`, `radius.control`, `padding-inline: space.2`, `padding-block: space.1`. It is text, so home is never marked by color alone. Its path also shows the site root.

**Empty state.** In place of the list, the site-list empty panel pattern ([site-list.md](site-list.md)):
- `<h2>` "This site has no pages yet", line "The first page you add becomes your home page.", primary "Add a page".
- The head action is hidden while the list is empty.

**Limit reached.** At 50 pages the count reads "50 of 50 pages" in `color.text`. "Add page" becomes unavailable with its reason under the head actions, `font_size.body_s`, `color.text_muted`: "This site has 50 pages, the most a site can hold. Delete one to add another."

**After add.** Back from the add form, the new page is the last row. Focus goes to its title link and the list status says "Our work added at position 5 of 5."

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | Screen head with the `<h1>`; the eyebrow, count and action wait. Three placeholder rows (title and path lines). No handles or move buttons until the list is complete. | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty (no pages) | The empty panel with "Add a page". Count "0 of 50 pages". | `color.surface`, `color.border`, `radius.card`, `space.7`, `color.text_muted`, `color.accent`, `color.on_accent` |
| Error on a field | Cannot happen: this screen has no fields. A failed load shows the list error: a form message block "Error: We couldn't load the pages of this site." with a secondary "Try again" `space.4` below it. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached (50 pages) | "50 of 50 pages"; "Add page" unavailable with its reason. | `color.text`, `color.text_muted`, `color.border` |
| Server says `too_many_pages` | On the add form; see [page-form.md](page-form.md). The list reloads when the owner returns. | |
| One page | One row with the home marker; move controls are not shown, because there is nothing to move. | `color.text`, `color.border_strong` |
| Row hover, focus | Title underlines on hover; shared focus ring on each control. The row background stays, since the row is not one link. | `color.focus`, `border_width.focus` |
| Reordering, deleting | See [menu-reorder.md](menu-reorder.md) and [delete-confirm.md](delete-confirm.md). | |

## Limits

- Up to 50 rows. Every row is in the page at once; no virtual scrolling at this size.
- Title up to 80 code points, wraps over at most two lines from `breakpoint.md`, three below `breakpoint.sm`. Never cut off.
- Path up to 105 characters (`/s/`, 40, `/`, 60): wraps with `overflow-wrap: anywhere`.
- Position numbers have at most two digits.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | Each row has two lines: handle, position, title, home marker and path on the first; the actions on the second, aligned to the end, `space.2` above. "Add page" and the empty-state button are full width. Empty panel padding `space.5`. |
| `breakpoint.sm` to `breakpoint.md` | One line per row where it fits; actions wrap under the title when the title is long. |
| from `breakpoint.md` | One line per row: actions at the end. "Add page" at the end of the screen head. The list stays at `layout.content_width`. |

## Accessibility

- **`<h1>`:** "Pages". The eyebrow gives the site name; the document title is "Pages · Atelier Noor · Hivesite Studio".
- **Tab order.** Shell items, "Add page" (or the empty-state button), then per row: handle, title link, Move up, Move down, Delete; then the next row.
- **Keyboard paths.** Edit a page: Tab to its title, Enter. Add: "Add page", Enter. Delete: Tab to the row's "Delete", Enter or Space opens the confirm. Reorder: see [menu-reorder.md](menu-reorder.md).
- The list is an `<ol>` labelled by the `<h1>`, so screen readers announce "list, 5 items" and each position.
- The home marker reads "Home page" as part of the row; the home title link has `aria-describedby` pointing at it.
- Row buttons carry the page title in their names ("Delete About", "Move About up").
- The unavailable "Add page" reads its reason. The list status line is `role="status"`.
- Shared focus ring (`border_width.focus`, `color.focus`); every row control is at least `control.min_height` on each side.

## Motion

- The list follows the shell screen change: one shape, fade and rise over `motion.duration_base` with `motion.easing_enter`.
- A new row after add fades in as the one moving shape over `motion.duration_base`, `motion.easing_enter`.
- Reorder motion is in [menu-reorder.md](menu-reorder.md); the gap after a delete is in [delete-confirm.md](delete-confirm.md).
- Placeholders pulse per the shell loading placeholder, at `motion.duration_slower`.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. Rows are simply there and placeholders are static.

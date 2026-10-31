# Site list

The first screen after sign-in: the owner's sites, newest first, with paging, an empty state and the 10-site limit. Covers #60 and #46 AC1, AC2 and part of AC5. Shared rules are in [shell.md](shell.md); this note lists only what differs.

## Data

GET `/sites` (API-001), default `limit` of 20, then `cursor` from `next_cursor` for each Load more.

| Field | Shown as | Limit (API-001) |
|---|---|---|
| `name` | Row title, a link to the site's pages | 1 to 80 code points |
| `slug` | Public path `/s/{slug}` | 3 to 40 code points |
| `settings.language` | "Language: nl", the tag as stored | 2 to 35 code points |
| `updated_at` | "Updated 28 Oct 2026", a `<time>` with the full timestamp in `datetime`, date in the owner's locale | RFC 3339, UTC |
| `id` | Not shown. Builds the row link and removes duplicates when pages join. | UUIDv7 |
| `next_cursor` | Not shown. A value means Load more shows; `null` means the end of the list. | |

`settings.description`, `created_at` are not shown. Order is the server's: newest first by `created_at`. The studio never sorts the list itself.

**Count.** "n of 10 sites", where n is the number of sites loaded. With the default `limit` of 20 and the cap of 10, the first page holds every site, so the count is exact. Load more stays for the paging contract and for the rare race API-001 accepts, where an owner can end up with more than 10.

| Code | Where |
|---|---|
| `invalid_request` (`limit`) | Cannot happen: the studio always sends the default. If it does, the list error below. |
| `invalid_cursor` | On Load more: the studio reloads the list from the start, then shows the Load more failed state with its copy. |
| `unauthenticated` | Sign-in (#45). |
| network or server failure | The list error (first load) or Load more failed (later pages). |

## Structure

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <h1 tabindex="-1">Your sites</h1>
    <p class="hs-count" id="site-count">4 of 10 sites</p>
    <div class="hs-screen-head__actions">
      <a class="hs-button" href="/sites/new">New site</a>
    </div>
  </header>
  <ul class="hs-list" aria-labelledby="…h1…">
    <li class="hs-row">
      <a class="hs-row__title" href="/sites/{id}/pages">Atelier Noor</a>
      <p class="hs-row__meta">
        <span class="hs-path">/s/atelier-noor</span>
        <span>Language: nl</span>
        <span>Updated <time datetime="2026-10-28T09:14:03Z">28 Oct 2026</time></span>
      </p>
    </li>
    …
  </ul>
  <div class="hs-more">
    <button type="button" class="hs-button hs-button--secondary">Load more</button>
    <p class="hs-more__status" role="status"></p>
  </div>
  <!-- or, when next_cursor is null: -->
  <p class="hs-end">That's all your sites.</p>
</main>
```

## Layout

- Screen head per shell. The count sits under the `<h1>`, `space.2` above it, in the counter style (`font.label`, `font_size.label`, `letter_spacing.body`, `color.text_muted`).
- The list is a shared list row list, inside `layout.wide_width`. Each row is a linked row: the whole row opens the site.
- Row title in the shared row title style. Meta items `space.4` apart in one wrapping line, `space.1` below the title. The path uses the shared path style.
- Load more: a secondary button, `space.6` below the list, aligned to the start. The status line sits beside it, `space.3` apart, `font_size.body_s`.
- End of the list: `font_size.body_s`, `color.text_muted`, `space.6` below the list. Shown only when the list is not empty and `next_cursor` is `null`.

**Empty state.** In place of the list:

```html
<section class="hs-empty" aria-labelledby="empty-title">
  <h2 id="empty-title">Your first site starts here</h2>
  <p>Give it a name and a path. You can change both later.</p>
  <a class="hs-button" href="/sites/new">Create a site</a>
</section>
```

- Panel `color.surface`, `border_width.hairline` solid `color.border`, `radius.card`, padding `space.7`, `max-inline-size: layout.content_width`.
- `<h2>` in the shell section style, line in `color.text_muted` `space.3` below, then the primary button `space.5` below.
- The head action is hidden while the list is empty, so the screen keeps one primary button.

**Limit reached.** At 10 sites the count reads "10 of 10 sites" in `color.text`. "New site" becomes unavailable (shell Button, Unavailable) with its reason under the head actions, `font_size.body_s`, `color.text_muted`: "You have 10 sites, the most for now. Sites can't be deleted yet." The same applies above 10.

**Load more.**

| State | Button | Status line |
|---|---|---|
| Idle | "Load more", secondary | empty |
| Loading | "Loading…", busy (unavailable) | visually hidden "Loading more sites…" |
| Failed | "Try again", secondary | "Error: We couldn't load more sites." in `color.error`, "Error:" in `font_weight.text_strong` |
| End (`next_cursor` is `null`) | removed | replaced by the end line "That's all your sites." |

New rows join the end of the list. A site whose `id` is already shown is skipped, so no site shows twice.

## States

| State | What shows | Tokens |
|---|---|---|
| Loading (first page) | Screen head with the `<h1>`; the count and action wait. Three placeholder rows (title line and meta line each). | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty (`items: []`, `next_cursor` `null`) | The empty state panel with "Create a site". Count "0 of 10 sites". | `color.surface`, `color.border`, `radius.card`, `space.7`, `color.text_muted`, `color.accent`, `color.on_accent` |
| Error on a field | Cannot happen: this screen has no fields. A failed first load shows the list error: a form message block "Error: We couldn't load your sites." with a secondary "Try again" `space.4` below it. | `color.surface`, `color.error`, `border_width.focus`, `color.text` |
| Limit reached (10 sites) | "10 of 10 sites"; "New site" unavailable with its reason. | `color.text`, `color.text_muted`, `color.border` |
| Server says `too_many_sites` | Shown on the create form, not here; see [site-form.md](site-form.md). When the owner returns, the list reloads and shows the limit reached state. | |
| Load more loading or failed | As in the Load more table. | `color.error`, `font_size.body_s` |
| End of list | "That's all your sites." | `color.text_muted`, `font_size.body_s` |
| Row hover, focus | Shared list row. | `color.surface`, `color.focus` |

## Limits

- Up to 10 sites in normal use; the list and the count handle more without breaking.
- Name up to 80 code points: wraps over at most two lines from `breakpoint.md`, three below `breakpoint.sm`. Never cut off.
- Path up to 43 characters (`/s/` plus 40), language tag up to 35: they wrap with `overflow-wrap: anywhere`.
- One Load more request at a time; the button is busy until it ends.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | Meta items stack, one per line, `space.1` apart. "New site", "Load more" and the empty-state button are full width. Empty panel padding `space.5`. |
| `breakpoint.sm` to `breakpoint.md` | Meta items in one wrapping line, as in Layout. |
| from `breakpoint.md` | Each row is one line where it fits: title and path at the start, language and last updated at the end, `space.5` apart; long names wrap and push the meta under them. "New site" sits at the end of the screen head. |

## Accessibility

- **`<h1>`:** "Your sites".
- **Tab order.** Shell items, then "New site" (or the empty-state button), then each row link in list order, then Load more. The unavailable "New site" stays in the order and reads its reason.
- **Keyboard paths.** Open a site: Tab to its row, Enter. Create: Tab to "New site", Enter. Load more: Tab to it, Enter or Space. Retry: the same button, now "Try again".
- After Load more, focus moves to the first new row's link and the status says "5 more sites loaded." When the end is reached, the status says "That's all your sites."
- The list is a `<ul>` labelled by the `<h1>`. Each row has one link, named by the site name; the meta is plain text inside it.
- The count is plain text, also used as the `aria-describedby` of "New site".
- Shared focus ring (`border_width.focus`, `color.focus`) on every link and button; rows and buttons are at least `control.min_height` tall.

## Motion

- First load: the list, as one shape, follows the shell screen change: fade and rise over `motion.duration_base` with `motion.easing_enter`.
- Load more: the new rows fade in together as one shape over `motion.duration_base`, `motion.easing_enter`. The rows already shown never move.
- Placeholders pulse per the shell loading placeholder, at `motion.duration_slower`.
- Reduced motion: durations become `motion.reduced_duration` and distances `motion.reduced_rise_distance`. Rows are simply there and placeholders are static.

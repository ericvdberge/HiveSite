# Card list (`card_list`)

Cards in a grid or a list, written by hand or drawn from a collection such as the site's pages, paged. Shared rules are in [design/README.md](../README.md#shared-block-rules).

This block also covers the "Blog list" named in issue #9: API-003 has no separate blog block, and a list of pages is a `card_list` with a `collection` source.

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `heading` | string, default `""` | up to 120 |
| `layout` | `grid` or `list`, default `grid` | |
| `source.kind` `manual` | `cards`: `{ title, body, image, action }` | 1 to 12 cards; title 1 to 80, body up to 300, action label 1 to 30 |
| `source.kind` `collection` | `entity_type` `page`, `sort`, `page_size` | page size 1 to 50 |

Both sources fill the same four slots: title, body, image and link. A page card has a title and a link, an empty body and no image (API-003).

## Structure

```html
<section class="hs-cards" data-layout="grid|list" aria-labelledby="…">
  <h2 id="…">…</h2>                          <!-- only when heading is not empty -->
  <ul class="hs-cards__items">
    <li class="hs-card">
      <img class="hs-card__image" src="…" alt="…">   <!-- only with image -->
      <h3 class="hs-card__title">
        <a href="…">…</a>                     <!-- link wraps the title when the card has one -->
      </h3>
      <p class="hs-card__body">…</p>          <!-- only when body is not empty -->
      <span class="hs-card__action" aria-hidden="true">…</span>   <!-- manual action label -->
    </li>
  </ul>
  <nav class="hs-pager" aria-label="…">…</nav>   <!-- collection, more than one page -->
</section>
```

**Whole-card link.** When a card has a link, the title's `<a>` gets a `::after` that covers the card, so the whole card is clickable but read as one link with the title as its name. The action label is shown as text with an arrow and hidden from screen readers, because the link already has a name. When the action label says more than the title (for example "Book a visit"), Rendering uses it as the link's `aria-label` suffix: "Ceramics, Book a visit".

## Layout

**Grid (`layout` `grid`).**
- Inside `layout.wide_width`. Equal columns, `gap: layout.grid_gap`.
- Card: `color.surface` background, `border_width.hairline` solid `color.border`, `radius.card`, `overflow: hidden`.
- Image on top, full card width, `aspect-ratio: media.card_ratio`, `object-fit: cover`.
- Text area padding `space.5`. Title, then body `space.2` below it, then action `space.4` below that, pushed to the bottom of the card so actions line up across a row.
- Cards in a row are equal height.

**List (`layout` `list`).**
- Inside `layout.content_width`. One card per row, no card background: rows divided by a `border_width.hairline` line in `color.border`, `space.5` padding above and below each row.
- With an image: image at the start, `media.list_thumb_width` wide at `media.card_ratio`, `radius.media`; text beside it with `space.5` between. Below `breakpoint.sm` the image moves above the text at full width.
- Without images: text only, full width. This is how a list of pages looks.

**Type.**
- Title: `font.display`, `font_size.display_m`, `font_weight.display_strong`, `line_height.heading`, color `color.text`. The title link has no underline at rest; it gets one on card hover and focus.
- Body: `font.text`, `font_size.body_s`, `line_height.body`, color `color.text_muted`.
- Action: label style (`font.label`, `font_size.label`, uppercase, `letter_spacing.label`) in `color.accent_text`, followed by "→".

## Columns by width (grid)

| Viewport | Columns |
|---|---|
| below `breakpoint.sm` | 1 |
| `sm` to `md` | 2 |
| `md` and up | 3 |

Grid stays at 3 columns at most so a 300-code-point body stays readable.

## Pager (collection source)

When the collection has more entries than `page_size`, a pager follows the list, `space.7` above it.

```
← Newer       Page 2 of 5       Older →
```

- Previous and next are links in the shared link style; the middle is label style in `color.text_muted`.
- On the first page "previous" is absent, on the last page "next" is absent. Their space is kept so the middle does not jump.
- Wording follows `sort`: `newest` uses "Newer" and "Older"; `natural` and `title` use "Previous" and "Next".
- `aria-label` on the `nav` is the block heading plus "pages", or "Cards pages" without a heading. The current page is not a link.

How later pages are reached (their URLs) is for the Rendering and Publishing specs (API-003). This note only fixes how the pager looks.

## States

| State | Look |
|---|---|
| Card without image | Grid: no image area, text starts at the top. Cards in the same row with and without images stay equal height; text aligns to the top. |
| Card without link | Not clickable; no hover change, no action. |
| Card without body | Title and action only. |
| Collection empty (a site with one page) | The block renders its heading and the line "Nothing here yet." in `color.text_muted`. Rendering confirms this text in its spec; it is the only owner-invisible copy this block adds. |
| Hover (linked card) | Grid: border moves from `color.border` to `color.border_strong`. List: title underlines. `motion.duration_base`. |
| Focus (linked card) | Focus ring on the card's outline, drawn with `:focus-within` around the whole card. |

## Limits

- Manual: up to 12 cards, 4 rows at 3 columns.
- Collection: up to 50 per page. At 3 columns that is 17 rows, so lists of pages are better in `list` layout; the editor may suggest it.
- Title 80 code points, up to three lines at `display_m`. Body 300, up to seven lines in a grid card. Nothing is truncated.

## Accessibility

- A list of cards, `<ul>`/`<li>`. Card titles are `<h3>` under the block's `<h2>`; without a block heading they stay `<h3>` and the section has `aria-label`.
- One link per card, named by its title. No nested interactive elements.
- Images in cards use their `alt`. Page cards have no image.

## Motion

- Grid: cards reveal with `motion.stagger`, first 6 only. List: the block reveals as one shape.
- Hover changes color only, never lifts or scales.
- Reduced motion: shown at once, hover changes are instant.

# Gallery (`gallery`)

A grid of 1 to 24 images. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `heading` | string, default `""` | up to 120 |
| `images` | array of `{ url, alt, caption }`, required | 1 to 24; alt and caption up to 200 |
| `columns` | integer, default `3` | 2 to 4 |

## Structure

```html
<section class="hs-gallery" aria-labelledby="…">   <!-- aria-label="Gallery" without heading -->
  <h2 id="…">…</h2>                                   <!-- only when heading is not empty -->
  <ul class="hs-gallery__grid" style="--hs-gallery-columns: 3">
    <li>
      <figure>
        <img src="…" alt="…" loading="lazy" decoding="async">
        <figcaption>…</figcaption>                   <!-- only when caption is not empty -->
      </figure>
    </li>
  </ul>
</section>
```

`--hs-gallery-columns` carries the owner's `columns` value. It is content, not a design value, so it is the one inline style allowed.

## Layout

- Inside `layout.wide_width`, centered, with `layout.gutter`.
- Block heading per the shared rule.
- Grid: `display: grid`, equal columns, `gap: layout.grid_gap`.
- Every tile has the same `aspect-ratio: media.gallery_ratio`, `object-fit: cover`, `radius.media`. A calm, even grid matters more than showing every image uncropped; the single `image` block is for uncropped images.
- Caption under its tile: `font.text`, `font_size.body_s`, `line_height.body`, color `color.text_muted`, `space.2` above.

## Columns by width

| Viewport | `columns` 2 | 3 | 4 |
|---|---|---|---|
| below `breakpoint.sm` | 1 | 2 | 2 |
| `sm` to `md` | 2 | 2 | 3 |
| `md` and up | 2 | 3 | 4 |

## States

| State | Look |
|---|---|
| One image | One tile, as wide as one column at the chosen `columns`, left-aligned. It does not stretch to full width; the `image` block does that. |
| Last row not full | Tiles keep their column width and align to the start. |
| Tile loading / fails | Shared image rules, inside the tile ratio. |
| Some captions empty | Rows stay aligned to the top of the tiles; empty captions add no space. |

## Limits

- 24 images at most. At 4 columns that is 6 rows; at 2 columns on a phone (from `columns` 3 or 4), 12 rows.
- Captions up to 200 code points. They wrap; in a tile column they can run to five lines, which is acceptable because captions are optional.
- No lightbox and no click action in version 1. Published sites are static and the schema has no link per image. A lightbox is a follow-up story.

## Accessibility

- A list (`<ul>`) so screen readers announce "list, 12 items".
- Each tile is a `<figure>` with its own `alt` and optional `<figcaption>`.
- The section is labelled by its heading, or `aria-label="Gallery"` without one.
- Tiles are not focusable; there is nothing to do with them.

## Motion

- Tiles reveal with the shared reveal, `motion.stagger` apart, the first 6 only; the rest appear with the sixth.
- No hover zoom or shift.
- Reduced motion: shown at once.

# Image (`image`)

One image with alt text and an optional caption. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `image` | `{ url, alt }`, required | alt up to 200 |
| `caption` | string, default `""` | up to 200 |
| `width` | `content`, `wide` or `full`, default `content` | |

## Structure

```html
<section class="hs-image" data-width="content|wide|full">
  <figure>
    <img src="…" alt="…" loading="lazy" decoding="async">
    <figcaption>…</figcaption>   <!-- only when caption is not empty -->
  </figure>
</section>
```

## Layout

| `width` | Image box | Radius | Gutter |
|---|---|---|---|
| `content` | `layout.content_width`, centered | `radius.media` | `layout.gutter` |
| `wide` | `layout.wide_width`, centered | `radius.media` | `layout.gutter` |
| `full` | viewport width | none | none; section has no inline padding |

- The image keeps its own aspect ratio (`height: auto`). No crop.
- The image is at most `media.image_max_height` tall, so a tall portrait never fills more than one screen; when it hits that cap it is centered in its box at its own ratio.
- Caption: `font.text`, `font_size.body_s`, `line_height.body`, color `color.text_muted`, `space.3` above. It aligns with the start of the image and is held to `layout.measure`. For `full`, the caption sits inside `layout.content_width` and `layout.gutter`, so it never touches the screen edge.

## States

| State | Look |
|---|---|
| Loading | Box in `color.placeholder_media` at the image's ratio if Rendering knows it, else `media.card_ratio`. |
| Fails | Same box with the alt text centered in `color.text_muted`, `font_size.body_s`. |
| No caption | No `figcaption` element. |

## Limits

- Caption up to 200 code points, two to four lines. Nothing is cut off.
- No link on the image in version 1; the schema has no link attribute.

## Responsive

- Below `breakpoint.md`, `wide` behaves like `content` plus gutter, which at that width is nearly full; `full` stays edge to edge.
- Rendering should emit `sizes` matching the box (`content_width`, `wide_width`, `100vw`) when it can offer more than one source. Version 1 has one external URL, so `srcset` is not required.

## Accessibility

- `<figure>` with `<figcaption>` ties the caption to the image.
- `alt` comes from `image.alt`. An empty alt renders `alt=""` and the image is skipped by screen readers; the caption, if any, is still read.
- Alt and caption are separate: Rendering never copies one into the other.

## Motion

- Shared reveal, one shape. No zoom on hover; the image is not interactive.
- Reduced motion: shown at once.

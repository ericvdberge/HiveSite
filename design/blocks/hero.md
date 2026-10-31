# Hero (`hero`)

A large opening section with a title, an optional image and one call to action. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `title` | string, required | 1 to 80 |
| `subtitle` | string, default `""` | up to 160 |
| `image` | `{ url, alt }` or `null` | alt up to 200 |
| `cta` | `{ label, href }` or `null` | label 1 to 30 |

## Structure

```html
<section class="hs-hero" data-variant="text|image">
  <img class="hs-hero__image" src="…" alt="…">   <!-- only with image -->
  <div class="hs-hero__body">
    <h1 class="hs-hero__title">…</h1>
    <p class="hs-hero__subtitle">…</p>          <!-- only when not empty -->
    <a class="hs-button" href="…">…</a>          <!-- only with cta -->
  </div>
</section>
```

Class names are a suggestion for Rendering; the order of elements is the rule.

## Layout

Two variants, chosen by whether `image` is `null`.

**Text only (`image` is `null`).**
- Background `color.background`. Body is left-aligned in `layout.wide_width`, text held to `layout.content_width`.
- Padding: `layout.section_y` above and below, at least `space.9` above.
- A short line in `color.rule` above the title: `space.7` wide, `border_width.hairline` high, `space.5` below it.

**With image.**
- The image is full bleed, `object-fit: cover`, at least `media.hero_min_height` tall, `radius` none.
- `color.image_scrim` covers the whole image. Text on it uses `color.on_image`, including the subtitle; the button keeps its own colors.
- Body sits at the bottom left of the image, inside `layout.wide_width` and `layout.gutter`, with `layout.section_y` below it.

**Type.**
- Title: `font.display`, `font_size.display_xl`, `font_weight.display`, `line_height.display`, `letter_spacing.display`, `text-wrap: balance`. Color `color.text` (or `on_image`).
- Subtitle: `font.text`, `font_size.body_l`, `line_height.body`, color `color.text_muted` (or `on_image`), `space.4` above, max width `layout.measure`.
- Button: the shared button, `space.6` above.

## States

| State | Look |
|---|---|
| Title only | Title and rule. No empty subtitle or button elements. |
| Image loading | Box at `media.hero_min_height` filled with `color.placeholder_media`; scrim and text already shown. |
| Image fails | Same as loading. The text stays readable because the scrim sits on `placeholder_media`. |
| CTA hover / focus | Shared button rules. |

## Limits

- Title is 80 code points at most. At `display_xl` that is up to three lines on a phone; nothing is truncated.
- Subtitle is 160 at most, about three lines at `body_l`.
- One hero per page is the expected use. If an owner adds a second, it renders with an `<h2>` title at `font_size.display_l` so the page keeps one `<h1>`. This is a Rendering rule to confirm in its spec.

## Responsive

| Width | Change |
|---|---|
| below `breakpoint.sm` | Image variant: height is `max(media.hero_min_height, content height)` so long titles never overflow the image. |
| `sm` to `md` | No change. |
| `md` and up | No change; the `clamp()` sizes do the scaling. |

## Accessibility

- The title is the page's `<h1>`.
- `image.alt` is the image's `alt`. The hero image is often decorative; an empty alt is fine and renders `alt=""`.
- The image is an `<img>`, not a CSS background, so its alt text is read and it can load eagerly with `fetchpriority="high"`.
- The CTA is a link with its own visible label; no "click here" text is added.
- On-image text contrast is checked against the scrim over pure white, the worst case for any photo (6.97:1).

## Motion

- Title, subtitle and button reveal in that order, `motion.stagger` apart, using the shared reveal.
- The image does not move: no zoom, no parallax. One shape at a time.
- Reduced motion: everything is shown at once.

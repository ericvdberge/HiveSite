# Embed (`embed`)

A video or map from an allowed provider. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `provider` | `youtube`, `vimeo` or `google_maps`, required | |
| `url` | `https://` URL on the provider's host, required | |
| `title` | string, required | 1 to 120 |
| `aspect_ratio` | `16:9`, `4:3` or `1:1`, default `16:9` | |

## Structure

```html
<section class="hs-embed" data-provider="youtube">
  <figure>
    <div class="hs-embed__frame" style="aspect-ratio: 16 / 9">
      <iframe src="…" title="…" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
    <figcaption>…</figcaption>
  </figure>
</section>
```

`aspect-ratio` carries the owner's `aspect_ratio` (`16:9` becomes `16 / 9`). Like the gallery's columns, it is content, so it is the one inline style allowed.

## Layout

- Inside `layout.wide_width` for `16:9` and `4:3`; inside `layout.content_width` for `1:1`, so a square map never fills the screen.
- The frame fills its column at the chosen ratio, `radius.media`, `overflow: hidden`, background `color.placeholder_media`. The `iframe` fills the frame with no border.
- The `title` is shown as the caption under the frame: `font.text`, `font_size.body_s`, color `color.text_muted`, `space.3` above. Above the caption, a provider label in label style (`font.label`, `font_size.label`, uppercase, `letter_spacing.label`, `color.text_muted`): "YouTube", "Vimeo" or "Google Maps".

## States

| State | Look |
|---|---|
| Loading | Frame in `color.placeholder_media` with the title centered in `color.text_muted`. |
| Provider blocked or offline | The frame stays at its ratio with the placeholder; the caption still names what was there. Rendering adds a link "Open on YouTube" (or the provider) to `url` under the caption, so the content stays reachable. |
| Focus inside | The provider's own player handles focus; the frame gets the shared focus ring through `:focus-within`. |

## Limits

- Title 120 code points, up to two lines under the frame.
- No autoplay, no muted loop. Rendering never adds `autoplay` to the URL.

## Responsive

- The frame scales with its column; the ratio holds at every width.
- Below `breakpoint.sm`, `1:1` widens to the full gutter width like the others.

## Accessibility

- The `iframe` `title` is the `title` attribute, so screen readers announce what the frame holds.
- The visible caption repeats it, which helps everyone and costs nothing.
- The fallback link means the content is reachable without the frame.

## Motion

- Shared reveal for the whole figure. The player's own motion is the provider's.
- Reduced motion: shown at once; no autoplay in any case.

## Open points for Rendering

- Privacy-friendly hosts (`www.youtube-nocookie.com`, Vimeo `dnt=1`) and a click-to-load facade are good for visitors and for EU consent rules. They change the URL Rendering emits, so they belong in the Rendering spec, not here.

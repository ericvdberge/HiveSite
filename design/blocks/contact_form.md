# Contact form (`contact_form`)

A form of 1 to 10 fields that posts to an external address. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Attributes (API-003)

| Attribute | Type | Limit |
|---|---|---|
| `heading` | string, default `""` | up to 120 |
| `intro` | string, default `""` | up to 300 |
| `action_url` | `https://` URL, required | |
| `fields` | array of `{ name, label, kind, required }` | 1 to 10; label 1 to 60 |
| `submit_label` | string, default `"Send"` | 1 to 30 |

`kind` is `text`, `email`, `phone` or `textarea`.

## Structure

```html
<section class="hs-form" aria-labelledby="…">
  <h2 id="…">…</h2>                       <!-- only when heading is not empty -->
  <p class="hs-form__intro">…</p>          <!-- only when intro is not empty -->
  <form method="post" action="…">
    <div class="hs-field">
      <label for="f-…">Name <span class="hs-field__req">(required)</span></label>
      <input id="f-…" name="…" type="text" autocomplete="name" required>
    </div>
    …
    <button type="submit" class="hs-button">Send</button>
  </form>
</section>
```

| `kind` | Element | Extra attributes |
|---|---|---|
| `text` | `<input type="text">` | |
| `email` | `<input type="email">` | `autocomplete="email"` |
| `phone` | `<input type="tel">` | `autocomplete="tel"` |
| `textarea` | `<textarea rows="5">` | |

For `text`, Rendering adds `autocomplete="name"` only when `name` is `name`; otherwise none. Field `id`s are made unique per page from the block and field name.

## Layout

- Column `layout.content_width`, centered. The form sits on `color.surface` with `border_width.hairline` solid `color.border`, `radius.card` and `space.6` padding (`space.5` below `breakpoint.sm`).
- Block heading per the shared rule, above the panel. Intro under the heading: `font.text`, `font_size.body_l`, color `color.text_muted`, `space.6` below.
- Fields stack in one column, `space.5` apart. No side-by-side fields; they would break with long labels.
- Label above its control, `space.2` between: `font.text`, `font_size.body_s`, `font_weight.text_strong`, color `color.text`.
- Required marker: the word "(required)" after the label in `color.text_muted`, `font_weight.text`. Not an asterisk alone.
- Control: full width, `control.min_height`, `control.padding_x`/`padding_y`, background `color.surface_sunk`, `border_width.control` solid `color.border_strong`, `radius.control` (capped at `radius.card` for `textarea`, so pill themes do not round a tall box), `font.text`, `font_size.body`, color `color.text`. `textarea` is `resize: vertical`.
- Submit: the shared button, `space.6` above the last field, aligned to the start.

## States

| State | Look |
|---|---|
| Rest | As above. |
| Hover | Border to `color.text_muted`, `motion.duration_base`. |
| Focus | Shared focus ring, plus border to `color.focus`. |
| Invalid (after a submit attempt) | Border to `color.error`; under the control a message in `color.error`, `font_size.body_s`, starting with "Error:" text, not only color. Uses `:user-invalid` so nothing is red before the visitor tries. |
| Submitting | The browser's own navigation to `action_url`. Hivesite adds no spinner; the page is static. |
| Disabled | Not used. |

The error text comes from the browser's own validation in version 1. Custom messages would need a script and copy per language, which no spec covers yet.

## Limits

- 10 fields at most, so the panel is at most about two screens tall on a phone.
- Label 60 code points, at most two lines. Intro 300, about four lines.
- Submit label 30 code points; the button grows, it never truncates. Below `breakpoint.sm` the button is full width.

## Accessibility

- Every control has a visible `<label for>`. No placeholder text stands in for a label; Rendering emits no `placeholder`.
- `required` fields carry the `required` attribute and the visible "(required)" word.
- Error messages are tied to the control with `aria-describedby` when shown.
- The form is labelled by the block heading, or `aria-label="Contact form"` without one.
- Targets are at least `control.min_height` (44 px) tall.
- `action_url` is external; the button label is the owner's, so Rendering adds no "opens elsewhere" text.

## Motion

- The panel reveals as one shape.
- Hover and focus are color changes over `motion.duration_base`; reduced motion makes them instant.

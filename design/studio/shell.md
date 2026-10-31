# Studio shell

The frame every studio screen sits in: top bar, navigation slot, content area, not-found screen and error toast. This note also holds the shared studio rules (field, field error, button, dialog, list row, limit counter, loading placeholder). The other studio notes link here and list only what differs.

The studio uses the `atelier` theme from `tokens.json`, with no theme switch. Every value below is a token path in that theme. Color pairs come from the Color roles table in [design/README.md](../README.md#color-roles). Values the studio needs but `tokens.json` does not have are in [Token gaps](#token-gaps), never written as literals.

## Data

The shell reads one thing from the API: the error code of a failed call.

| Code | Status | Where it shows |
|---|---|---|
| `site_not_found` | 404 | Not-found screen, site variant. From GET, PATCH `/sites/{id}`, GET and POST `/sites/{id}/pages`, PUT `/sites/{id}/menu`. |
| `page_not_found` | 404 | Not-found screen, page variant. From GET and PATCH `/pages/{id}`. DELETE has its own handling in [delete-confirm.md](delete-confirm.md). |
| `unauthenticated` | 401 | Not shown by the shell. Sign-in (#45) owns it. |
| any other failure without a field (network, 5xx, an unknown code) | | Error toast. |

`error.message` from the server is never shown. The studio branches on `error.code` and shows its own copy, as the API-001 Errors convention says.

The navigation slot shows the site `name` (1 to 80 code points) when a site screen is open.

## Structure

```html
<body>
  <a class="hs-skip" href="#main">Skip to content</a>
  <header class="hs-topbar">
    <a class="hs-topbar__mark" href="/">Hivesite <span>Studio</span></a>
    <div class="hs-topbar__account"><!-- slot for #45 --></div>
  </header>
  <div class="hs-frame">
    <nav class="hs-nav" aria-label="Studio">
      <ul>
        <li><a href="/" aria-current="page">Sites</a></li>
        <!-- on a site screen: -->
        <li class="hs-nav__site">Atelier Noor</li>
        <li><a href="…/pages">Pages</a></li>
        <li><a href="…/settings">Settings</a></li>
      </ul>
    </nav>
    <main id="main" class="hs-content" tabindex="-1">
      <header class="hs-screen-head">
        <p class="hs-eyebrow">…</p>          <!-- optional -->
        <h1 tabindex="-1">…</h1>
        <div class="hs-screen-head__actions">…</div>
      </header>
      …
    </main>
  </div>
  <div class="hs-toast" popover="manual" role="alert">…</div>
</body>
```

- Each screen has exactly one `<h1>`, inside the screen head. The notes name it.
- The top bar and navigation are the same on every screen; only the nav items and the content change.
- The toast and dialogs use the browser's top layer (`popover`, `<dialog>` with `showModal()`), so they need no stacking value.

## Layout

**Frame.** Background `color.background`. Text `color.text`, `font.text`, `font_size.body`, `line_height.body`.

**Top bar.**
- Full width, `padding-inline: layout.gutter`, `padding-block: space.3`, a bottom edge of `border_width.hairline` solid `color.border`.
- Start: the wordmark "Hivesite" in `font.display`, `font_size.display_m`, `font_weight.display`, `color.text`, then "Studio" in label style (`font.label`, `font_size.label`, `font_weight.label`, `letter_spacing.label`, uppercase) in `color.accent_text`, `space.2` apart. The wordmark is a link to the site list, at least `control.min_height` tall.
- End: an empty account slot for #45.
- The top bar scrolls with the page. A sticky bar needs a stacking token (see Token gaps).

**Navigation slot.**
- A list of links in `font.text`, `font_size.body_s`. Each link is at least `control.min_height` tall with `padding-inline: space.3`.
- Rest: `color.text_muted`. Hover: `color.text`. Current (`aria-current="page"`): `color.text`, `font_weight.text_strong`, with a mark on the inline start of `border_width.focus` solid `color.accent`. The weight change means the current item is not marked by color alone.
- The site name is a group label, not a link: label style in `color.text_muted`, `space.5` above it. It wraps; it is never cut off.

**Content area.**
- `max-inline-size: layout.wide_width`, `padding-inline: layout.gutter`, `padding-block: space.7`.
- Forms and dialogs inside it are no wider than `layout.content_width`. Text never runs wider than `layout.measure`.

**Screen head.**
- Eyebrow in label style, `color.accent_text`, `space.2` above the `<h1>`.
- `<h1>`: `font.display`, `font_size.display_l`, `font_weight.display`, `line_height.display`, `letter_spacing.display`, `color.text`.
- Lead text under it, if any: `font_size.body`, `color.text_muted`, `space.3` above.
- Actions sit at the end of the head from `breakpoint.md`, under the heading below it. `space.6` below the head.
- Section headings inside a screen are `<h2>`: `font.display`, `font_size.display_m`, `font_weight.display_strong`, `line_height.heading`.

### Not-found screen

Shown in the content area when a call returns `site_not_found` or `page_not_found`. The top bar and nav stay; the nav shows only "Sites", because the site cannot be trusted.

```html
<main id="main" class="hs-content">
  <header class="hs-screen-head">
    <p class="hs-eyebrow">Not found</p>
    <h1 tabindex="-1">We can't find that site</h1>
  </header>
  <p>It may have been removed, or the link may be wrong.</p>
  <a class="hs-button" href="/">Back to your sites</a>
</main>
```

| Code | `<h1>` | Line | Action |
|---|---|---|---|
| `site_not_found` | We can't find that site | It may have been removed, or the link may be wrong. | Back to your sites |
| `page_not_found` | We can't find that page | It may have been deleted, or the link may be wrong. | Back to pages, when the screen knows the site; otherwise Back to your sites |

- Line in `font_size.body_l`, `color.text_muted`, `space.6` below it, then the action as the primary button.
- The eyebrow reads "Not found" in words; the status number is not shown.

### Error toast

For a failure no field or screen owns: the network is down, the server failed, or a code the screen does not know.

```html
<div class="hs-toast" popover="manual" role="alert">
  <p><strong>Error:</strong> We couldn't save that. Please try again.</p>
  <button type="button" class="hs-button hs-button--quiet">Dismiss</button>
</div>
```

- Position: fixed to the bottom end of the viewport, `space.5` from both edges. `max-inline-size: layout.content_width`.
- Panel `color.surface`, `border_width.hairline` solid `color.error` (stand-in for elevation; see Token gaps), `radius.card`, padding `space.4` and `space.5`, a row with the text and the Dismiss button, `space.4` apart.
- Text `color.text`, `font_size.body_s`. "Error:" in `color.error`, `font_weight.text_strong`. The word carries the meaning, not the color.
- One toast at a time. A new error replaces the text of the open toast.
- It stays until the owner dismisses it or the failed action succeeds. It never closes on a timer, so nobody has to read against the clock.

| Situation | Copy |
|---|---|
| No network | We can't reach Hivesite. Check your connection and try again. |
| Server error or unknown code | Something went wrong on our side. Please try again. |
| A save that failed (the screen adds the noun) | We couldn't save the {noun}. Your changes are still here. |

### Shared studio rules

These hold on every studio screen.

#### Field

```html
<div class="hs-field">
  <label for="site-name">Name <span class="hs-field__req">(required)</span></label>
  <p class="hs-field__hint" id="site-name-hint">…</p>        <!-- optional -->
  <input id="site-name" name="name" aria-describedby="site-name-hint site-name-count site-name-error">
  <div class="hs-field__foot">
    <p class="hs-field__error" id="site-name-error">…</p>    <!-- only when invalid -->
    <p class="hs-counter" id="site-name-count">12 of 80</p>  <!-- only for a maximum -->
  </div>
</div>
```

- One column, fields `space.5` apart. Label above the control, `space.2` between.
- Label: `font.text`, `font_size.body_s`, `font_weight.text_strong`, `color.text`. "(required)" in `color.text_muted`, `font_weight.text`. Never an asterisk alone.
- Hint: `font_size.body_s`, `color.text_muted`, between the label and the control, `space.1` above the control. Hints state the rule in words, so the owner knows it before typing.
- Control: full width of the form column, `control.min_height`, `control.padding_x` and `control.padding_y`, background `color.surface_sunk`, `border_width.control` solid `color.border_strong`, `radius.control` (a `textarea` keeps `radius.control` too; it is square enough in `atelier`), `font.text`, `font_size.body`, `color.text`. A `textarea` is `resize: vertical`.
- No placeholder text stands in for a label or a hint.
- Rest, hover (border to `color.text_muted`), focus (shared focus ring plus border to `color.focus`).
- Read-only while the form is sending: `readonly`, the same look, the value stays readable.
- The form checks each field on blur after the owner has typed in it, and all fields on submit. Lengths count code points after trimming, as API-001 Validation says.

#### Field error

- Under the control in the field foot, `space.2` above: `font_size.body_s`, `color.error`, starting with "Error:" in `font_weight.text_strong`. The control border turns `color.error`.
- Tied to the control with `aria-describedby`; the control gets `aria-invalid="true"`.
- On a submit with errors, focus moves to the first invalid field. Nothing is red before the owner has tried.
- A server error with a `field` lands on that field with the same look. A server error without a field shows as a form message.
- The error clears as soon as the value meets the rule.

**Form message.** A message for the whole form (a count limit, an error without a field), first in the form, `space.5` below it, `role="alert"`: background `color.surface`, an inline-start edge of `border_width.focus` solid `color.error`, padding `space.4`, text `color.text`, "Error:" in `color.error`, `font_weight.text_strong`.

**Note.** The same block for a calm notice that is not an error (a slug warning, a reload): inline-start edge `color.rule` (decorative), "Note:" in `color.accent_text`, `font_weight.text_strong`, text `color.text`, `role="status"`.

#### Button

All buttons: `font.text`, `font_size.body_s`, `font_weight.text_strong`, `radius.control`, `min-block-size: control.min_height`, `control.padding_x` and `control.padding_y`. Hover adds an underline to the label, as in the shared button rule in design/README.md; fills never change, so every pair stays tested.

| Kind | Use | Look |
|---|---|---|
| Primary | The one main action of a screen or form | `color.accent` fill, `color.on_accent` text. |
| Secondary | Cancel, Load more, Try again | No fill, `border_width.control` solid `color.border_strong`, `color.text`. |
| Danger | Delete | No fill, `border_width.control` solid `color.error`, `color.error` text. The label names the action ("Delete page"), so color is not the only signal. |
| Quiet | Row actions, Dismiss, move up and down | No fill, no border, `color.text`. Hover: background `color.surface`. A square quiet button is `control.min_height` on each side. |

**Unavailable.** A button that cannot act right now uses `aria-disabled="true"`, not `disabled`, so it stays in the tab order and its reason can be read. Look: no fill, `border_width.control` solid `color.border`, `color.text_muted` text. The reason is visible text next to it, tied with `aria-describedby`. Pressing it does nothing.

**Busy.** While a request runs, the button label changes to the verb in progress ("Creating…", "Saving…", "Deleting…") and the button is unavailable. No spinner.

One primary button per screen or dialog.

#### Dialog

```html
<dialog class="hs-dialog" aria-labelledby="dlg-title" aria-describedby="dlg-body">
  <h2 id="dlg-title">…</h2>
  <div id="dlg-body">…</div>
  <div class="hs-dialog__actions">
    <button type="button" class="hs-button hs-button--secondary">Cancel</button>
    <button type="button" class="hs-button …">…</button>
  </div>
</dialog>
```

- Opened with `showModal()`: focus stays inside, the page behind is inert, Escape cancels.
- Panel `color.surface`, `border_width.hairline` solid `color.border_strong` (stand-in for elevation), `radius.card`, padding `space.6`. `max-inline-size: layout.content_width`, with `layout.gutter` kept free on both sides.
- `::backdrop` uses `color.image_scrim` as a stand-in until an overlay color exists (see Token gaps).
- Title: the section `<h2>` style. Body `space.4` below it, `color.text`; secondary lines `color.text_muted`.
- Actions at the end, `space.6` above them, `space.3` apart, Cancel first.
- Each dialog note says where focus goes on open, on cancel and after the action.

#### List row

```html
<ul class="hs-list">
  <li class="hs-row">
    <a class="hs-row__title" href="…">…</a>
    <p class="hs-row__meta">…</p>
    <div class="hs-row__actions">…</div>
  </li>
</ul>
```

- Rows divided by `border_width.hairline` solid `color.border`, with one above the first row. `padding-block: space.4`, `padding-inline: space.3`, at least `control.min_height` tall.
- Title: `font.text`, `font_size.body`, `font_weight.text_strong`, `color.text`. Meta: `font_size.body_s`, `color.text_muted`. Paths (`/s/{slug}`) in `font.label`, `font_size.body_s`, `letter_spacing.body`, not uppercase, `color.text_muted`.
- When a row opens something, the title link covers the row with `::after`, the same whole-card link as `card_list`. Row actions sit above that cover and stay their own targets.
- Hover on a linked row: background `color.surface`, title underlined. Focus: the shared focus ring around the row via `:focus-within`.
- Text wraps; nothing is cut off.

#### Limit counter

- Shown under a control whose limit is a maximum, at the end of the field foot: "12 of 80". Label style without uppercase: `font.label`, `font_size.label`, `letter_spacing.body`, `color.text_muted`.
- It counts code points after trimming, the same count the server uses. Inputs carry no `maxlength`, because the browser counts UTF-16 units and would stop some names short.
- At the limit ("80 of 80") it stays `color.text_muted`; the value is valid.
- Over the limit ("82 of 80") it turns `color.error` and the field shows its field error, so the count is not the only signal.
- Screen readers hear the counter as part of the description. A hidden live region says "Limit reached" once when the count first reaches the maximum, not on every key.

**Count limits** (sites per owner, pages per site) use the same words and look in the screen head: "4 of 10 sites". The notes say what happens at the limit.

#### Loading placeholder

- While a screen or list loads, it shows grey shapes where the content will be: blocks of `color.placeholder_media`, `radius.card`, one per expected line, as tall as that line (`font_size.body` at `line_height.body` for a row title).
- Lists show three placeholder rows. Forms show a placeholder for each label and control.
- The shapes pulse between `color.placeholder_media` and `color.surface_sunk`, `motion.duration_slower` each way, `motion.easing_standard`. That is slower than `motion.duration_slow`.
- Under reduced motion the shapes are static `color.placeholder_media`.
- The shapes are `aria-hidden="true"`. The region has `aria-busy="true"` and a visually hidden status line ("Loading sites…").

#### Screen change

- On a new screen, focus moves to its `<h1>` (`tabindex="-1"`), and the document title becomes "{h1} · Hivesite Studio".
- After a form is sent and the studio opens another screen, focus goes to that screen's `<h1>`, unless the note says otherwise.

## States

| State | What shows | Tokens |
|---|---|---|
| Loading | The top bar and nav at once; the content area shows the screen's loading placeholder. | `color.placeholder_media`, `color.surface_sunk`, `radius.card`, `motion.duration_slower` |
| Empty | Each screen defines its empty state. The shell itself is never empty: the top bar and the "Sites" link always show. | |
| Error on a field | The field error rule above. | `color.error`, `font_size.body_s`, `font_weight.text_strong` |
| Limit reached | The count limit reads "10 of 10"; the action is unavailable with its reason in words. | `color.text_muted`, `color.border`, `color.text` |
| Not found | The not-found screen in the content area, nav reduced to "Sites". | `font_size.display_l`, `font_size.body_l`, `color.text_muted`, `color.accent`, `color.on_accent` |
| Error without a field | The error toast. | `color.surface`, `color.error`, `color.text`, `radius.card` |
| Skip link focused | The skip link shows at the top start, background `color.surface`, `color.text`, padding `space.3`, focus ring. Hidden off-screen until focused. | `color.surface`, `color.text`, `space.3` |

## Limits

- Site name in the nav: up to 80 code points, wraps over at most three lines in the side column.
- One toast at a time; one open dialog at a time.
- Screen heads: an `<h1>` is a fixed phrase or a page title (up to 80 code points). Long titles wrap; they are never cut off with an ellipsis.

## Responsive

| Viewport | Change |
|---|---|
| below `breakpoint.sm` | Content `padding-block: space.6`. Screen-head actions sit under the heading at full width. Every button that ends a form or a dialog is full width, and dialog actions stack, Cancel first. Dialog padding `space.5`. The toast spans the viewport width minus `space.4` on each side and sits at the bottom. The wordmark keeps "Studio". |
| `breakpoint.sm` to `breakpoint.md` | The nav is a row of links under the top bar, wrapping to a second line when needed, with a bottom edge of `border_width.hairline` solid `color.border`. The current link's mark moves to the block end. The site name label sits before the site links in the row. |
| from `breakpoint.md` | Two columns: the nav as a side column (`max-content`, see Token gaps) and the content area, `space.7` apart. The nav sits `space.7` below the top bar. Screen-head actions move to the end of the head. |
| from `breakpoint.lg` | No change; the content area stops at `layout.wide_width`. |

Below `breakpoint.md` the nav is the row described for `sm` to `md`; below `breakpoint.sm` it keeps that look.

## Accessibility

- **Tab order.** Skip link, wordmark, account slot, nav links in order, then the content area from top to bottom, then the toast's Dismiss button when a toast is open.
- **Keyboard paths.** Enter follows a link or presses a button; Space presses a button. Escape closes a dialog or, with focus inside it, the toast. Every action in the studio can be done without a pointer.
- **Focus ring.** Every interactive element shows `outline: border_width.focus solid color.focus` with `outline-offset: border_width.focus_offset` on `:focus-visible`, as in design/README.md. Never removed.
- **Targets.** Every control and link that acts alone is at least `control.min_height` in both directions.
- **Landmarks.** `header`, `nav` labelled "Studio", `main`. The toast is outside `main`.
- **Headings.** Each screen's `<h1>` is named in its note. Not-found: "We can't find that site" or "We can't find that page". Dialogs and sections use `<h2>`.
- **Live regions.** The toast is `role="alert"`. Status lines (loading, saved, moved) use `role="status"`. Only one of each region per screen.
- **Color.** Every text pair is from the README Color roles table: `color.text` and `color.text_muted` on `color.background`, `color.surface` and `color.surface_sunk`; `color.accent_text` on `color.background` and `color.surface` only, never on `color.surface_sunk`; `color.on_accent` on `color.accent`; `color.error` on the three surfaces. Errors always say "Error:" in words.

## Motion

Follows the brand and design/README.md Motion: one shape at a time, nothing faster than `motion.duration_base`.

- **Screen change.** The content area, as one shape, fades in from `opacity: 0` and `translateY(motion.rise_distance)` over `motion.duration_base` with `motion.easing_enter`. The top bar and nav never move.
- **State changes.** Hover, focus and press change colors and borders over `motion.duration_base` with `motion.easing_standard`. Nothing grows or bounces.
- **Toast.** Enters with the same fade and rise over `motion.duration_base`, `motion.easing_enter`; leaves with a fade over `motion.duration_base`, `motion.easing_standard`.
- **Dialog.** The backdrop appears at once; the panel, as the one moving shape, fades and rises over `motion.duration_base` with `motion.easing_enter`. Closing fades the panel over `motion.duration_base`, `motion.easing_standard`.
- **Loading placeholder.** Pulses at `motion.duration_slower` each way, as above.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, every duration becomes `motion.reduced_duration` and every distance `motion.reduced_rise_distance`: screens, toasts and dialogs are simply there, state changes are instant, and placeholders are static.

## Token gaps

Values the studio notes needed that `tokens.json` does not have. Each note uses the stand-in until a separate PR adds the token to all three themes (see design/README.md, Changing tokens). The proposed names are written plain, not as token paths, because they do not exist yet.

| Need | Proposed name | Used in | Stand-in until then |
|---|---|---|---|
| Dialog backdrop color | color.overlay | shell (dialog), delete-confirm | `color.image_scrim` |
| Raised surface (toast, dialog, dragged row) | elevation.raised | shell (toast, dialog), menu-reorder | an edge of `border_width.hairline` in `color.border_strong` or `color.error` |
| Warning color for a notice | color.warning | site-form, page-form (slug change) | the Note block: `color.rule` edge and the word "Note:" |
| Success color for a saved message | color.success | site-form, page-form, menu-reorder | `color.text_muted` text; the words carry the meaning |
| Stacking order (sticky top bar, dragged row above the list) | z_index.sticky, z_index.drag | shell, menu-reorder | top bar scrolls with the page; dialog and toast use the top layer; the dragged row stays in the list flow |
| Side navigation width | layout.nav_width | shell | `max-content` |
| Dialog and toast width | layout.dialog_width | shell, delete-confirm | `layout.content_width` |
| Unavailable control colors | color.disabled_text, color.disabled_border | shell (button) | `color.text_muted` text and `color.border` edge |
| Icon size (drag handle, move arrows) | icon.size | page-list, menu-reorder | a text glyph at `font_size.body` |
| Placeholder pulse colors | color.placeholder_pulse | shell (loading placeholder) | between `color.placeholder_media` and `color.surface_sunk` |
| Drop indicator width | border_width.indicator | menu-reorder | `border_width.focus` |

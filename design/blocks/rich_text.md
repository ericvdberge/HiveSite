# Rich text (`rich_text`)

Headings, paragraphs and lists, with bold, italic and links. Shared rules are in [design/README.md](../README.md#shared-block-rules).

## Content (API-003)

Tiptap JSON in `content`, 1 to 200 top-level nodes, at most 10,000 code points of text.

| Node or mark | Element |
|---|---|
| `paragraph` | `<p>` |
| `heading` level 2, 3 | `<h2>`, `<h3>` |
| `bulletList` / `orderedList` / `listItem` | `<ul>` / `<ol start="…">` / `<li>` |
| `hardBreak` | `<br>` |
| `bold` / `italic` | `<strong>` / `<em>` |
| `link` | `<a href="…">` with Rendering's own `rel` |

## Structure

```html
<section class="hs-rich-text">
  <div class="hs-prose">
    <h2>…</h2>
    <p>… <strong>…</strong> … <a href="…">…</a></p>
    <ul><li><p>…</p></li></ul>
  </div>
</section>
```

## Layout

- Column `layout.content_width`, centered. Lines never wider than `layout.measure`.
- Body: `font.text`, `font_size.body`, `font_weight.text`, `line_height.body`, color `color.text`.
- Vertical rhythm by margin-top only, so the first element has none:

| Element | Type | Space above |
|---|---|---|
| `p` | body | `space.4` |
| `h2` | `font.display`, `font_size.display_l`, `font_weight.display`, `line_height.heading` | `space.7` |
| `h3` | `font.display`, `font_size.display_m`, `font_weight.display_strong`, `line_height.heading` | `space.6` |
| element right after `h2`/`h3` | | `space.3` |
| `ul`, `ol` | body, `padding-inline-start: space.5` | `space.4` |
| `li` | body | `space.2` |
| nested list | | `space.2` |

- `strong` uses `font_weight.text_strong`. `em` is the text face in italic; the display face is never used inline.
- Bullets and numbers use `color.text_muted`, via `::marker`.
- Links follow the shared link rule.

## States

| State | Look |
|---|---|
| Empty paragraph or heading | Kept, so owners' deliberate blank lines survive. An empty paragraph is one line high. |
| Only a heading | Heading with section padding; no special case. |
| Link hover / focus | Shared link and focus rules. |

## Limits

- Lists nest at most 3 levels (API-003). Each level indents by `space.5`; at 3 levels on a phone that leaves more than 70 % of the width for text.
- The longest allowed block (10,000 code points) is about 1,500 words. No "read more" fold; the page simply scrolls.
- Long URLs written as text wrap with `overflow-wrap: anywhere`.

## Responsive

The type scale is fluid through the tokens, so the block has no breakpoints. Below `breakpoint.sm` the gutter shrinks with `layout.gutter`.

## Accessibility

- Headings stay `h2` and `h3` as written; Rendering never promotes or demotes them, so the outline under the hero `h1` is correct.
- `orderedList.attrs.start` becomes `start` on `<ol>`. `orderedList.attrs.type` and the link mark's `target`, `rel` and `class` are ignored (API-003).
- Links open in the same tab. External links get `rel="noopener"` from Rendering, not from content.
- Text is escaped; `<b>` typed by an owner shows as the characters `<b>`.

## Motion

- The whole block reveals as one shape with the shared reveal. Paragraphs do not stagger.
- Reduced motion: shown at once.

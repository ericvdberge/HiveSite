---
name: rendering-domain
description: What is true in Hivesite's Rendering module (themes from design tokens, block rendering, preview, and the template build of ADR 3) - purity, token use, contrast and motion rules, determinism and snapshot tests, plus which specs are still open. Use when building, fixing or reviewing code in src/Modules/Rendering.
---

# Rendering domain

The specs, `design/` and the ADRs are the authority; this skill is the short version. When this skill and a spec disagree, the spec wins: tell the manager so this file gets fixed.

## Specs: none approved yet

| Spec | What | Status |
|---|---|---|
| API-010 | Themes: the three themes, their tokens and assets | in review |
| API-011 | Block rendering and draft preview (the C# renderer) | draft, **held** for ADR 3 |
| API-012 | Intro and loader on published sites | draft, held |
| ADR 3 | Sandboxed Vue/Nuxt templates replace the C# block renderer | proposed |

Build nothing that isn't in an approved spec. If ADR 3 is accepted, Rendering becomes the **template build runner plus the default template**, not a C# HTML renderer. Check the ADR's status before you start, and treat API-011's markup as reference only until it's approved again.

## True either way

- **Pure.** Content + theme in, files out. The same input gives the same bytes: no clock, no random values, no culture-dependent formatting, stable ordering. Under ADR 3: "template + snapshot → static files".
- **No database, stores nothing.** No EF Core and no Npgsql (`Hivesite.ArchitectureTests` fails the build otherwise). No site state either: brand styling is read through `Hivesite.Content.Contracts`.
- **Trusts Content.** Blocks and entities arrive already validated (API-003, API-004, API-005). Don't validate them again, and don't reach into Content's internals.
- **Plain strings are escaped.** Titles, captions and alt text are HTML-escaped. Rich text is Tiptap JSON and never HTML: the `text` `<b>` shows as the characters `<b>`.
- **Link attributes are ours.** Ignore the stored `target`, `rel` and `class` on link marks and `type` on `orderedList`; Rendering sets its own.
- **Snapshot tests** cover every block type in every theme. Under ADR 3 that applies to the default template's HTML.
- **Rendering is not Publishing.** It returns files and never stores a release or decides what's live.

## Design tokens

- **Tokens only.** Never a literal color, size, font, duration or breakpoint in code or markup. HTML carries classes, never values, and has no inline styles.
- **Custom properties**: `--hs-` plus the token path joined with `-`, with `_` turned into `-`. For example, `color.text_muted` is `--hs-color-text-muted` and `space.5` is `--hs-space-5`.
- **Breakpoints** can't be used inside `@media`, so the stylesheet build writes their values into the media queries from `design/tokens.json`.
- **Themes**: `atelier` (dark, the default), `ivory` and `studio` (light). Each has the same token groups and names. A renamed token is a breaking change and needs new versions of the spec and of `tokens.json`.
- **Contrast** (WCAG 2.2 AA, as the color roles in `design/README.md`):
  - 4.5:1 for `text`, `text_muted` and `error` on `background`, `surface` and `surface_sunk`;
  - 4.5:1 for `accent_text` on `background` and `surface`;
  - 4.5:1 for `on_accent` on `accent`;
  - 3:1 for `border_strong` and `focus` on the three surfaces.

  A test checks every theme.
- **Motion**: every `motion.duration_*` is at least 300 ms. Content is visible without JavaScript. Under `prefers-reduced-motion: reduce`, the `reduced_*` tokens apply and nothing autoplays.
- **Assets**: names are `{base}.{8 hex of SHA-256}.{css|woff2}`, so they can be cached forever. Fonts are served from Hivesite, never a third party, and the stylesheet has no `url()` to another host.
- **Block layout** follows `design/blocks/<type>.md` and the shared block rules in `design/README.md`:
  - one `<section>` per block;
  - the hero title is the page's only `<h1>`;
  - block headings are `<h2>`, and an empty heading renders nothing;
  - focus is always visible;
  - every image has a size or an aspect ratio.

## Under ADR 3 (if it's accepted)

- Rendering starts a throwaway sandbox (Firecracker or gVisor) for each build, with:
  - no network and no secrets;
  - a read-only root and a non-root user;
  - limits of 2 vCPU, 2 GB memory, 256 processes, 1 GB disk and 5 minutes.

  A build over any limit is killed and fails.
- The input is the site snapshot bytes from `GetSiteSnapshot` (API-005), written into the sandbox exactly as received.
- Our code, not the template's, reads the output folder and checks it:
  - it rejects symlinks, absolute paths, `..` and files outside the folder;
  - it enforces the release limits (3,000 files, 50 MB) before handing the files to Publishing.
- Never parse, import or run template code in the host process.

## Contracts

- `Hivesite.Rendering.Contracts` offers what Publishing needs: the theme registry (API-010) and the render or build call. Its exact shape waits on API-011 or the ADR 3 spec.
- Endpoint operation names (`ListThemes`, `GetThemeAsset`) are the `operationId`s and the C# method names. They never change.

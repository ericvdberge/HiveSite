# 3. Entities in Content, sandboxed Vue templates, one origin per site

Status: proposed · 2026-10-28

## Context
A site today is seven fixed block types (API-003) rendered by one C# renderer with three fixed themes. An owner cannot change a layout, a block's look or their brand colors, and every visual change is C# work for the Rendering team. Brand styling was about to become a one-off `jsonb` column on `content.sites` with three choices and no colors, which cannot grow. The owner wants one architecture for all of it: brand styling as an entity with defaults, a color picker as a field type, and front-end work done in Vue by front-end developers, with the backend knowing nothing about it, but sandboxed. The business case is #36.

## Decision

### a. Content owns a generic entity system
- An entity type is a field schema: a list of typed fields, served with a JSON Schema (draft 2020-12, as API-003) that validates its values. Field types: `text`, `rich_text`, `number`, `boolean`, `select`, `color`, `image`, `link`, `entity_reference`.
- Values are stored in one `jsonb` column on one table, `content.entities`. Content validates on every write, so readers trust what they read.
- Two types are built in. `page` is a view over the existing pages (API-002) and their blocks (API-004); pages keep their own tables and endpoints. `brand_styling` is one entity per site with defaults, and replaces brand styling as a site field.
- A `color` field fills a named design-token slot and is checked for WCAG 2.2 AA contrast on save, so an owner's own color can never make a theme unreadable.
- Owner-defined types come later on the same table, schema and endpoints. The spec is API-005.

### b. Sandboxed Vue/Nuxt templates replace the C# block renderer
- A **template** is a Nuxt project that turns one site snapshot into static files. The backend contract with a template is only "snapshot JSON in, static files out". The backend never parses, imports or runs template code in its own process.
- Hivesite ships two npm packages for templates:
  - `@hivesite/composables`: `useSite()`, `usePage()`, `useMenu()`, `useBlocks()`, `useEntity(type)`, `useEntities(type)`, all reading the snapshot.
  - `@hivesite/blocks`: one default Vue component per block type, for example `<cards-view :items="items" />` for `card_list`. A template uses them as they are, wraps them or replaces them.
- Hivesite's own three themes (Atelier, Ivory, Studio from `design/tokens.json`) become the first template, the **default template**. It is our reference for the packages, and its HTML has snapshot tests. Its markup may differ from the markup in API-011; its own spec fixes it.
- Template code, ours or an owner's, runs only at preview and publish time, in a throwaway container:
  - no network at all, no secrets, no host mounts except the read-only inputs;
  - read-only root file system, a non-root user, and a microVM or userspace-kernel boundary (Firecracker or gVisor; the spike in #36 picks one), never a plain shared-kernel container;
  - limits per build: 2 vCPU, 2 GB memory, 256 processes, 1 GB scratch disk, 5 minutes wall clock. A build over any limit is killed and fails;
  - inputs: the template source and the site snapshot (API-005) as a file. No `npm install` from the network, in v1 or in a separate step: the build image has a pinned Node LTS, Nuxt, Vue and the `@hivesite/*` packages, and a template may only import packages on that image's fixed allowlist. Growing the allowlist is a change to the build image, made by Hivesite;
  - output: a folder of static files. Our code, not the template, reads it, rejects symlinks, absolute paths, `..` and files outside the folder, and enforces the release limits (3,000 files, 50 MB).
- Publishing stores the output as a release, exactly as it would have stored C# output. Releases, rollback and the live pointer do not change. A build cannot fit in one HTTP request, so publish and preview become asynchronous jobs with a status.

### c. Every site gets its own origin
- Template JavaScript runs in visitors' browsers. Serving every site under one path on the API origin (`/s/{site_slug}/`) would let one site's script read another site's storage and reach the API origin's cookies.
- Each site is served from its own origin: a subdomain per site on a dedicated registrable domain that is not the app or API domain, and that is on the Public Suffix List, so browsers keep cookies and storage apart between sites. Previews are served from a separate per-site preview origin, never from the admin origin; the admin shows them in a sandboxed `<iframe>`.
- The domain's name is chosen in #3 (name, domains and trademarks).
- This needs wildcard DNS and wildcard TLS. Custom domains later reuse the same mechanism.

### d. Consequences for Rendering and for ADR 1
- ADR 1 still holds: one host, three modules, talking through `.Contracts`. Rendering changes job.
- **Rendering becomes the template build runner plus the default template.** In C# it starts the sandbox, passes the snapshot in, collects and checks the output, and hands it to Publishing through `Rendering.Contracts`. It also owns the default template and the two npm packages. It still has no database (ADR 2) and stores nothing: a build is a pure function of template and snapshot.
- The rule "Rendering is pure: content + theme → HTML" becomes "a build is pure: template + snapshot → static files". For the default template, the same snapshot gives the same files, and HTML snapshot tests stay. For owner templates we only guarantee the sandbox and the output limits.
- Content does not know what a template does with the snapshot. Publishing does not know a build happened; it receives files.

## Consequences
- One entity engine replaces three special cases: pages, brand styling and card collections (API-003 `card_list` already reads collections by entity type).
- Owners get their own colors with contrast guaranteed on save.
- Visual work moves to Vue. This needs a front-end team and agent, Node and TypeScript in CI, and a change to the stack and rules in `CLAUDE.md`. Those are `team:factory` changes for a human.
- Rendering's write scope grows to the default template and the `@hivesite/*` packages. Where they live in the repo is decided in the first Rendering story.
- In-flight specs written for the C# renderer need new versions: API-010 (themes become tokens for the default template), API-011 (preview becomes a build), API-012 (the intro moves into the default template), API-020 (publish becomes asynchronous) and API-021 (one origin per site). API-001's statement that a site is served at `/s/{slug}` changes with API-021.
- Running untrusted code is the largest new risk. The sandbox limits above are the minimum; the spike in #36 must show a clean kill on every limit before any template from outside Hivesite is accepted.
- Previews get slower: a build takes seconds, not milliseconds.

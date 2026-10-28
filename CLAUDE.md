# Hivesite

A block-based website builder, designed and built by a team of AI agents. Owners compose pages from a fixed set of blocks, pick a theme and publish a static site with releases they can roll back. The full plan is in [docs/plan.html](docs/plan.html).

## Stack
- C# .NET 10, ASP.NET Core minimal APIs, modular monolith ([ADR 1](docs/adr/0001-modular-monolith.md))
- PostgreSQL with EF Core, one schema per module ([ADR 2](docs/adr/0002-postgresql.md))
- Modules: Content, Rendering, Publishing. They talk only through `*.Contracts` projects.

## Commands
- Build: `dotnet build -warnaserror`
- Test: `dotnet test`
- Format: `dotnet format`
- Spec index: `node scripts/spec-index.mjs` (CI runs it with `--check`)
- Board: `node scripts/board.mjs list [Column]`, `node scripts/board.mjs move <issue> "<Column>"`

## Factory
Work is run by the agents in `.claude/agents/` following `.claude/skills/run-story`. Run the manager as the main thread: `claude --agent manager`.

| Label | Agent | Writes |
|---|---|---|
| `team:content` | `dev-content` | `src/Modules/Content`, its tests |
| `team:rendering` | `dev-rendering` | `src/Modules/Rendering`, its tests |
| `team:publishing` | `dev-publishing` | `src/Modules/Publishing`, its tests |
| `team:design` | `designer` | `design/` |
| specs | `api-architect` | `specs/` |
| `team:factory` | a human with Claude | `.claude/`, `scripts/`, `.github/` |

Board: [project 8](https://github.com/users/ericvdberge/projects/8), recorded in `.github/factory.json`. Columns: Backlog → Ready → Spec review → Building → Agent review → Ready to merge → Done. Humans move stories into Ready, merge spec PRs and merge build PRs. Agents never merge.

Expertise comes from existing plugins enabled in `.claude/settings.json`: `pr-review-toolkit` (Anthropic) for code review, and `dotnet-contribution`, `backend-development`, `ui-design`, `startup-business-analyst` from [wshobson/agents](https://github.com/wshobson/agents). Tune our own agents and skills when they slip; don't fork the upstream ones.

## Git and PRs
- Never commit to `main`. Branches: `story/<issue>-<slug>`, `spec/API-NNN-<slug>`, `chore/<slug>`, `factory/<slug>`.
- Conventional Commits with a scope: `feat(content): …`, `docs(spec): …`, `chore(factory): …`.
- One PR per story, using the PR template, with `Closes #N` and `Spec: API-xxx`. Spec PRs and build PRs are separate.
- Squash merge.

## Rules
- Build exactly what the approved spec says. Gaps go back to the spec, not into the code.
- Rendering is pure: content + theme → HTML, no database. Renderers use design tokens only.
- Errors use the shape in `specs/STYLE.md`. Ids are prefixed strings.
- Every acceptance criterion has a test. Rendered HTML has snapshot tests.

## Brand
Quiet luxury, built by many. Calm, precise, warm; short sentences. Tagline: *Crafted by many. Made for you.* Colors: Ink `#100E0B`, Panel `#17140F`, Champagne `#CDAE74`, Bronze `#94733A`, Ivory `#F5F1E8`, Stone `#A69D8C`. Type: Cormorant Garamond (display), Hanken Grotesk (text), IBM Plex Mono (labels). Motion: one shape at a time, nothing faster than 300 ms, always a reduced-motion fallback.

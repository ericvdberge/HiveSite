# Hivesite

A block-based website builder, designed and built by a team of AI agents. Owners compose pages from a fixed set of blocks, pick a theme and publish a static site with releases they can roll back. The full plan is in [docs/plan.html](docs/plan.html).

## Stack
- C# .NET 10, ASP.NET Core minimal APIs, modular monolith ([ADR 1](docs/adr/0001-modular-monolith.md))
- PostgreSQL with EF Core, one schema per module ([ADR 2](docs/adr/0002-postgresql.md))
- Modules: Content, Rendering, Publishing. They talk only through `*.Contracts` projects.
- FluentValidation for requests, Mapperly for DTO mapping, and one repository and one service per entity. The C# patterns are in [src/CLAUDE.md](src/CLAUDE.md).

## Commands
- Build: `dotnet build -warnaserror`
- Test: `dotnet test`
- Format: `dotnet format`
- Spec index: `node scripts/spec-index.mjs` (CI runs it with `--check`)
- Board: `node scripts/board.mjs list [Column]`, `node scripts/board.mjs move <issue> "<Column>"`, `node scripts/board.mjs sync` (closed issues → Done; run it after you merge)

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
- Errors use the shape in `specs/STYLE.md`. Ids are UUIDv7 strings.
- No exceptions for business logic: not found returns `null`, a broken rule returns a `Result<T>` with an `Error`. C# patterns are in [src/CLAUDE.md](src/CLAUDE.md).
- Every acceptance criterion has a test. Rendered HTML has snapshot tests.

## Cross-module data access
Modules are API domain boundaries. A module never reads another module's data directly. It asks the owning module through that module's contract.

### Rules
- **Never** reference another module's `Hivesite.<Module>` project, DbContext, entities, repositories or tables. Only reference `Hivesite.<Module>.Contracts`. `tests/Hivesite.ArchitectureTests` enforces this (`ModuleBoundaries.cs`); do not weaken or bypass it.
- **Never** write a new querier, repository or SQL in the consuming module to get another module's data. If the contract doesn't offer what you need, extend the owning module's contract (see below).
- Depend on the interface (`I<Module>Api`) via constructor injection. Never on a concrete implementation, and never on a generated HTTP client class (it is `internal` on purpose).
- Do not use HTTP between modules inside the monolith. Calls are in-process through DI.

### The contract is OpenAPI-first
Target setup; the generator is not wired up yet. Until it is, write `I<Module>Api` and its DTOs by hand in `Hivesite.<Module>.Contracts`, following the same rules. Each module will have, in `src/Modules/<Module>/Hivesite.<Module>.Contracts/`:
- `openapi.yaml`: the source of truth for what the module offers other modules
- `nswag.json`: generator config (interface + DTOs, System.Text.Json, HTTP client `internal`)
- `Generated/I<Module>Api.g.cs`: **generated, never edit by hand**

`operationId` becomes the C# method name (`GetPageSummary` → `GetPageSummaryAsync`). Choose operationIds deliberately; renaming one is a breaking change for every consumer.

### Adding data another module needs
1. Edit the **owning** module's `openapi.yaml`: add the operation (with an explicit `operationId`) and any schemas. Return only what consumers need; never mirror internal entities.
2. Regenerate: `dotnet tool restore` once, then `dotnet build` (the contracts project regenerates when the spec or `nswag.json` changes). To run the generator manually: `cd src/Modules/<Module>/Hivesite.<Module>.Contracts && dotnet nswag run nswag.json`.
3. Implement the new method in the owning module's `internal sealed class <Module>ModuleApi : I<Module>Api`. Map internal model → contract DTO there; internal types never leave the module.
4. If the operation should also be public over HTTP, add the endpoint in `<Module>Module.Map<Module>Endpoints()`, delegating to `I<Module>Api`.
5. In the consuming module, inject `I<Module>Api` and call the method.
6. Commit the contract, the regenerated `.g.cs`, and the implementation together.

### Setting up a module's contract
The first module to get the pipeline is the template; copy its `Hivesite.<Module>.Contracts` setup. Rename namespaces, and set `namespace`, `className` (`<Module>Api` → interface `I<Module>Api`), `exceptionClass` and `output` in `nswag.json`. Register the implementation in `Add<Module>Module()` as `services.AddScoped<I<Module>Api, <Module>ModuleApi>()`.

### Errors
"Not found" and similar outcomes are module-specific exceptions defined in the owning module (e.g. `PageNotFoundException`). Document the matching status code in the spec. HTTP endpoints translate them to status codes and the `ApiError` shape in `specs/STYLE.md`; in-process callers catch them.

### When the contract is the wrong tool
If a module needs another module's data constantly, or must keep working without it, prefer integration events (like `PageChanged` in `Hivesite.Content.Contracts`) and a local read model in the consuming module over adding chatty contract calls. Raise this with the team before building it.

## Brand
Quiet luxury, built by many. Calm, precise, warm; short sentences. Tagline: *Crafted by many. Made for you.* Colors: Ink `#100E0B`, Panel `#17140F`, Champagne `#CDAE74`, Bronze `#94733A`, Ivory `#F5F1E8`, Stone `#A69D8C`. Type: Cormorant Garamond (display), Hanken Grotesk (text), IBM Plex Mono (labels). Motion: one shape at a time, nothing faster than 300 ms, always a reduced-motion fallback.

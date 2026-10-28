# Rendering module

Themes from design tokens, block renderers and the draft preview. Owned by `dev-rendering`. Specs: API-010 to API-019 in `specs/rendering/`. Designs: `design/`.

## Layout
- `Hivesite.Rendering/`: themes, renderers, endpoints. `RenderingModule` is the only entry point the Host calls.
- `Hivesite.Rendering.Contracts/`: what other modules may use, such as the renderer interface Publishing calls.
- Tests: `tests/Hivesite.Rendering.Tests/`.

## Rules
- Pure: content + theme → HTML. No database, no EF Core, no Npgsql. `Hivesite.ArchitectureTests` fails the build on a database package.
- Content comes in through `Hivesite.Content.Contracts`, already validated. Do not validate it again.
- Renderers use design tokens only, never hard-coded colors, sizes or fonts.
- Every renderer has snapshot tests per block type and theme.
- Reference only `Hivesite.Shared`, this module's Contracts and other modules' Contracts.

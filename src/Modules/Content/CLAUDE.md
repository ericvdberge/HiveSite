# Content module

Sites, pages, the menu, block types and block validation. Owned by `dev-content`. Specs: API-001 to API-009 in `specs/content/`.

## Layout
- `Hivesite.Content/`: `Domain`, `Application`, `Infrastructure`, `Endpoints` folders. `ContentModule` is the only entry point the Host calls.
- `Hivesite.Content.Contracts/`: what other modules may use. Interfaces, events (`SiteChanged`, `PageChanged`, `MenuChanged`) and their DTOs. Nothing else.
- Tests: `tests/Hivesite.Content.Tests/`.

## Rules
- Reference only `Hivesite.Shared`, this module's Contracts and other modules' Contracts. `Hivesite.ArchitectureTests` fails the build otherwise.
- Own `DbContext`, schema `content` (ADR 2). Never read another module's tables.
- Integration tests run over HTTP against PostgreSQL from `Hivesite.Testing.PostgresFixture`. Call `SkipIfUnavailable()` first.
- Errors use `Hivesite.Shared.ApiError` and the codes in the spec. Validation errors set `field`.

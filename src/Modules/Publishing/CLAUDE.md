# Publishing module

Releases, history, rollback and serving the live site. Owned by `dev-publishing`. Specs: API-020 to API-029 in `specs/publishing/`.

## Layout
- `Hivesite.Publishing/`: releases, rollback, serving. `PublishingModule` is the only entry point the Host calls.
- `Hivesite.Publishing.Contracts/`: what other modules may use, such as the "release published" event.
- Tests: `tests/Hivesite.Publishing.Tests/`.

## Rules
- Release metadata in its own `DbContext`, schema `publishing` (ADR 2). Release files on disk under `releases/` (git-ignored), blob storage later.
- Read content and rendered HTML only through `Hivesite.Content.Contracts` and `Hivesite.Rendering.Contracts`.
- Integration tests run against PostgreSQL from `Hivesite.Testing.PostgresFixture`. Call `SkipIfUnavailable()` first.
- Reference only `Hivesite.Shared`, this module's Contracts and other modules' Contracts.

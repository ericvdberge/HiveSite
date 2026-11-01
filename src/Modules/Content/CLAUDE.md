# Content module

Sites, pages, the menu, block types and block validation. Owned by `dev-content`. Specs: API-001 to API-009 in `specs/content/`. Build everything with the patterns in [src/CLAUDE.md](../../CLAUDE.md).

## Layout
- `Hivesite.Content/`
  - `Endpoints/`: `SiteEndpoints`, `SiteDtos`, `SiteValidators`, `SiteMapper`.
  - `Application/`: `SiteService`.
  - `Domain/`: `Site`, `SiteFilter`.
  - `Infrastructure/`: `ContentDbContext`, `SiteDao`, `SiteDaoMapper`, `SiteRepository`, `Migrations/`.
  - `ContentModule`: the only entry point the Host calls.
- `Hivesite.Content.Contracts/`: what other modules may use. Interfaces, events (`SiteChanged`, `PageChanged`, `MenuChanged`) and their DTOs. Nothing else.
- Tests: `tests/Hivesite.Content.Tests/`.

## Adding an entity (pages, menu, …)
1. `Domain/<Entity>.cs` and `Domain/<Entity>Filter.cs`.
2. `Infrastructure/<Entity>Dao.cs`, its mapping in `ContentDbContext.OnModelCreating` and `<Entity>DaoMapper`. Add a migration.
3. `Infrastructure/<Entity>Repository.cs`: the queries and saves it needs.
4. `Application/<Entity>Service.cs`: the spec's rules, calling the repository.
5. `Endpoints/`: DTOs, validators, Mapperly mapper, endpoints. Map them in `MapContentEndpoints`.
6. Register the repository and service as scoped in `AddContentModule`.

## Rules
- Reference only `Hivesite.Shared`, this module's Contracts and other modules' Contracts. `Hivesite.ArchitectureTests` fails the build otherwise.
- Own `DbContext`, schema `content` (ADR 2). Never read another module's tables.
- Everything is scoped to the signed-in owner (`UserContext`). Another owner's resource is the same 404 as a missing one.
- Errors use the codes in the spec. Validation errors set `field`.

## Dev seed
Sample data for local studio work, in `Hivesite.Content/Seeding/DevSeeder`. It creates everything through `SiteService` and `PageService`, so the rules hold and the change events are raised. It skips what exists (site slug, then page slug), so running it again changes nothing.

| Owner id | Sites |
|---|---|
| `dev-owner-a` | `dev-atelier-nord` (4 pages), `dev-atelier-full` (49 pages, one under the limit), `dev-atelier-empty` (no pages) |
| `dev-owner-b` | `dev-bureau-blau` (2 pages) |

Run it on demand, after the database is migrated: `await app.Services.SeedContentDevelopmentDataAsync()` (`ContentModule`). It writes nothing unless the environment is Development, and it never runs at startup. There is no sign-in yet (API-001 Decisions), so the owner ids are only usable from code and tests.

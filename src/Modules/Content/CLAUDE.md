# Content module

Sites, pages, the menu, block types and block validation. Owned by `dev-content`. Specs: API-001 to API-009 in `specs/content/`. Build everything with the patterns in [src/CLAUDE.md](../../CLAUDE.md).

## Layout
- `Hivesite.Content/`
  - `Endpoints/`: `SiteEndpoints`, `SiteDtos`, `SiteValidators`, `SiteMapper`.
  - `Application/`: `SiteService`.
  - `Domain/`: `Site`, `SiteFilter`.
  - `Infrastructure/`: `ContentDbContext`, `SiteDao`, `SiteDaoMapper`, `SiteRepository`, `Migrations/`.
  - Block types (API-003) have no database: `BlockTypes/*.json` (embedded schemas, copied verbatim from the spec, plus `defs.json`), `Infrastructure/BlockTypeRegistry` (singleton), `Application/BlockTypeService` and `ContentModuleApi` and `ContentApiMapper`, `Domain/BlockType`, `BlockTypeFilter`, `Endpoints/BlockTypeEndpoints`, `BlockTypeDtos`, `BlockTypeValidators`, `BlockTypeMapper`.
  - Page blocks (API-004, GET and PUT): `Domain/PageBlocks`, `PageBlocksFilter`, `Infrastructure/PageBlocksDao`, `PageBlocksDaoMapper`, `PageBlocksRepository` (one row per page, none means the empty document at version 1; the save checks the version and sets the page's `updated_at` in one transaction), `Application/PageBlocksService`, `Application/BlockDocumentValidator` (singleton, no database; trims, fills defaults and validates with JsonSchema.Net against the schemas of `BlockTypeRegistry`, the only source of schemas; after each block's schema check it runs `Application/BlockRules`, the API-003 "Rules beyond the schemas": static, no database, reads the block and never changes it), `Endpoints/PageBlocksEndpoints`, `PageBlocksRequest` (raw body and headers: 413, 415, `If-Match`; the blocks are open JSON, so no DTO and no FluentValidation validator), `PageBlocksDtos` (OpenAPI only).
  - `ContentModule`: the only entry point the Host calls.
- `Hivesite.Content.Contracts/`: what other modules may use. Interfaces (`IContentApi`), events (`SiteChanged`, `PageChanged`, `MenuChanged`) and their DTOs. Nothing else.
- Tests: `tests/Hivesite.Content.Tests/`.

## Adding an entity (pages, menu, …)
1. `Domain/<Entity>.cs` and `Domain/<Entity>Filter.cs`.
2. `Infrastructure/<Entity>Dao.cs`, its mapping in `ContentDbContext.OnModelCreating` and `<Entity>DaoMapper`. Add a migration.
3. `Infrastructure/<Entity>Repository.cs`: the queries and saves it needs.
4. `Application/<Entity>Service.cs`: the spec's rules, calling the repository.
5. `Endpoints/`: DTOs, validators, Mapperly mapper, endpoints. Map them in `MapContentEndpoints`.
6. Register the repository and service as scoped in `AddContentModule`.

## Rules
- The block type registry is code, not data: the seven types are fixed, there is no endpoint or table to change them. A schema change raises that type's `version` and needs a new spec version. Never hand-write a schema in C#; edit the JSON resource so it stays equal to the spec.
- Reference only `Hivesite.Shared`, this module's Contracts and other modules' Contracts. `Hivesite.ArchitectureTests` fails the build otherwise.
- Own `DbContext`, schema `content` (ADR 2). Never read another module's tables.
- Everything is scoped to the signed-in owner (`UserContext`). Another owner's resource is the same 404 as a missing one.
- Errors use the codes in the spec. Validation errors set `field`.

## Dev seed
Sample data for local studio work, in `Hivesite.Content/Seeding/DevSeeder`. It creates everything through `SiteService` and `PageService`, so the rules hold and the change events are raised. It skips what exists (site slug, then page slug), so running it again changes nothing.

| Owner id | Sites |
|---|---|
| `0198f1a0-0000-7000-8000-000000000001` (the admin) | `dev-atelier-nord` (4 pages), `dev-atelier-full` (49 pages, one under the limit), `dev-atelier-empty` (no pages) |
| `0198f1a0-0000-7000-8000-000000000002` | `dev-bureau-blau` (2 pages) |

Run it after the database is migrated: `await app.Services.SeedContentDevelopmentDataAsync()` (`ContentModule`). It writes nothing unless the environment is Development. The Host migrates and runs it at startup in Development when `Dev:Seed` is true (the default in `appsettings.Development.json`), and signs every Development request in as the admin, `ContentModule.DevelopmentOwnerId` (ADR 4, #118). Outside Development there is no sign-in yet, so the owner ids are only usable from code and tests.

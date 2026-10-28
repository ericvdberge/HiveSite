# C# patterns

How every module is built. Follow these; don't invent new plumbing. The Content module's sites (API-001) are the reference implementation: copy their shape for every new entity.

## Layers and flow

```
HTTP ─► Endpoint ─► Mapper ─► Service ─► Repository ─► DAO mapper ─► DbContext
        (DTO +      (DTO →    (entity    (entity)      (entity ↔
        validator)  entity)   only)                    DAO)
```

| Folder | Holds | Knows about |
|---|---|---|
| `Endpoints/` | `<Entity>Endpoints`, DTOs, FluentValidation validators, the Mapperly DTO mapper | DTOs, entities, services |
| `Application/` | `<Entity>Service : EntityService<TEntity>`, `IRepository<TEntity>` | entities |
| `Domain/` | Entities: plain classes, `IEntity` (+ `IAuditable` when timestamped) | nothing |
| `Infrastructure/` | `DbContext`, DAOs + `IEntityTypeConfiguration`, the DAO mapper, `Repository<TEntity, TDao>`, migrations | DAOs, entities |

Shared building blocks live in `src/Hivesite.Shared` (no database code there: Rendering references it and must stay pure).

## Endpoints
- One static class per entity. `Map<Entity>Endpoints` only maps routes; every handler is a `private static` method (`CreateSite`, `ListSites`, …).
- Handlers bind a DTO, map it, call the service, map back and return `TypedResults`. No `HttpContext`, no `if` chains, no try/catch.
- Validate with `.Validate<TDto>()` on the route. Owner endpoints use `MapGroup(...).RequireOwner()`.
- Lists bind `[AsParameters] PageQuery`, return `PageDto<T>`, and encode cursors with `CursorProtector` and a purpose per list.

```csharp
private static async Task<Created<SiteDto>> CreateSite(SitePostDto dto, SiteService service, CancellationToken ct)
{
    var site = await service.CreateAsync(SiteMapper.ToEntity(dto), ct);
    return TypedResults.Created($"/sites/{site.Id}", SiteMapper.ToDto(site));
}
```

## DTOs and validation
- Records named `<Entity>Dto` (response), `<Entity>PostDto`, `<Entity>PatchDto`. Input members are nullable: null means "not sent".
- Trim strings in the DTO: `public string? Name { get; init => field = value?.Trim(); }`.
- One `AbstractValidator<T>` per input DTO. Shared field rules go in a base validator; required fields add `NotNull()` in the POST validator. Use `CodePoints(min, max)` for lengths (specs count code points).
- Body strictness is global (`AddSharedServices`): unknown fields and wrong types are 400 `invalid_request` with `field` set from the JSON path. Don't parse JSON by hand.

## Mapping (Mapperly)
- Never map by hand. One `[Mapper]` for DTO ↔ entity (in `Endpoints/`), one for entity ↔ DAO (next to the DAO).
- DTO mappers use `AllowNullPropertyAssignment = false`, so a PATCH DTO mapped onto an entity changes only what was sent.
- Use `RequiredMappingStrategy.Target` and list skipped targets with `[MapperIgnoreTarget]`, so a new field can't be forgotten silently.

## Services
- One `<Entity>Service : EntityService<TEntity>` per entity. Its public methods take and return entities only, never DTOs or `IResult`.
- Override `Query` to scope reads (for example to the current owner) and `NotFound()` for the spec's 404 code.
- Business rules throw `BusinessRuleException(code, message, field?)` (400) or `NotFoundException` (404). `ApiExceptionHandler` turns them into the error body of `specs/STYLE.md`.
- Time comes from `ITimeService` (UTC, whole seconds). Never `DateTime.UtcNow`.
- Raise `*.Contracts` events from the service, after the write succeeded.

## Data access
- Services use `IRepository<TEntity>`: `Query` (LINQ over the DbSet), `AddAsync`, `UpdateAsync`. Register an entity with one line: `services.AddEntity<Site, SiteDao, SiteDaoMapper>()`.
- The repository sets UUIDv7 ids and `IAuditable` timestamps, and writes only when the change tracker sees a real change.
- DAOs are the table rows (`<Entity>Dao`), configured with `IEntityTypeConfiguration`. Columns become snake_case automatically.
- Always LINQ over the DbSet. No raw SQL, no `FromSql`, no `ExecuteSql`.
- Let unique indexes judge uniqueness; catch `DbUpdateException` with `IsUniqueViolation(index)` in the service.
- New migration: `dotnet ef migrations add <Name> --project src/Modules/<Module>/Hivesite.<Module> --output-dir Infrastructure/Migrations`.

## Keep it simple
- Build the spec, nothing more. No idempotency keys, caching, locking or retries until a human asks for them.
- No new abstraction until a second entity needs it. Prefer framework features (FluentValidation, Mapperly, EF Core, `TypedResults`) over helpers.

## Tests
- Integration tests run over HTTP through `WebApplicationFactory<Program>` against Postgres (`Hivesite.Testing.PostgresFixture`); call `SkipIfUnavailable()` first.
- Validators and mappers get plain unit tests, so most rules run without Docker.
- Name tests as sentences ending in the acceptance criterion: `A_taken_slug_is_refused_AC7`.

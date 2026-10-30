# C# patterns

How every module is built. Follow these; don't invent new plumbing. The Content module's sites (API-001) are the reference implementation: copy their shape for every new entity.

## Layers and flow

```
HTTP ─► Endpoint ─► Mapper ─► Service ─► Repository ─► Mapper ─► DbContext
        (DTO +      (DTO →    (rules,    (one per     (entity →
        validator)  entity)   entities)  entity)      DAO)
```

| Folder | Holds | Knows about |
|---|---|---|
| `Endpoints/` | `<Entity>Endpoints`, DTOs, FluentValidation validators, the Mapperly DTO mapper | DTOs, entities, services |
| `Application/` | `<Entity>Service` | entities, filters, its repository |
| `Domain/` | Entities (records) and `<Entity>Filter` | nothing |
| `Infrastructure/` | `DbContext`, `<Entity>Dao`, the Mapperly DAO mapper, `<Entity>Repository`, migrations | entities, DAOs |

Shared building blocks live in `src/Hivesite.Shared` (no database code there: Rendering references it and must stay pure).

## Endpoints
- One static class per entity. `Map<Entity>Endpoints` only maps routes; every handler is a `private static` method (`CreateSite`, `ListSites`, …).
- Handlers bind a DTO, map it, call the service, map back and return `TypedResults` (`Results<…>` when a failure is possible). No `HttpContext`, no `if` chains, no try/catch.
- Name the validator on the route, so F12 goes straight to it: `.Validate<SitePostValidator>()`.
- Signed-in endpoints use `MapGroup(...).RequireAuthorization()`. Services read the user from `UserContext`.
- Ids in routes are typed: `{id:guid}` and a `Guid id` parameter. No parsing by hand.
- Lists bind `[AsParameters] PageQuery`, map it to the entity's filter and return `PageDto<T>`. The cursor is the id of the last item; the service refuses one that is not the user's with `invalid_cursor`.

```csharp
private static async Task<Results<Created<SiteDto>, BadRequest<ApiError>>> CreateSite(SitePostDto dto, SiteService service, CancellationToken ct)
{
    var result = await service.CreateAsync(SiteMapper.ToEntity(dto), ct);
    return result.IsSuccess
        ? TypedResults.Created($"/sites/{result.Value.Id}", SiteMapper.ToDto(result.Value))
        : TypedResults.BadRequest(new ApiError(result.Error));
}
```

## DTOs and validation
- Records named `<Entity>Dto` (response), `<Entity>PostDto`, `<Entity>PatchDto`. Input members are nullable: null means "not sent".
- Trim strings in the DTO: `public string? Name { get; init => field = value?.Trim(); }`.
- One `AbstractValidator<T>` per input DTO, in `<Entity>Validators.cs`. Shared field rules go in a base validator; required fields add `NotNull()` in the POST validator. Use `CodePoints(min, max)` for lengths (specs count code points).
- Body strictness is global (`AddSharedServices`): unknown fields and wrong types are 400 `invalid_request` with `field` set from the JSON path. Don't parse JSON by hand.

## Mapping (Mapperly)
- Never map by hand. One static `[Mapper]` per entity for DTO ↔ entity (and query → filter), in `Endpoints/`, and one for entity ↔ DAO, in `Infrastructure/`.
- DTO mappers use `AllowNullPropertyAssignment = false`, so a PATCH DTO mapped onto an entity changes only what was sent.
- Use `RequiredMappingStrategy.Target` and list skipped targets with `[MapperIgnoreTarget]`, with a comment after each saying why, so a new field can't be forgotten silently.

## Services
- One `<Entity>Service` per entity, a plain class. It holds the spec's rules and calls its repository; no base class, no generic service.
- Public methods take and return entities and filters, never DTOs or `IResult`. Reads take one `<Entity>Filter`: a new way to filter is a new filter property, not a new method.
- Set ids (`Guid.CreateVersion7()`) and timestamps (`ITimeService`, never `DateTime.UtcNow`) in the service.
- **No exceptions for business logic.** Not found returns `null`. A broken rule that needs its own answer returns a `Result<T>` holding an `Error(code, message, field?)`; the endpoint turns it into the `ApiError` body of `specs/STYLE.md`. Exceptions are for bugs and the framework only (`ApiExceptionHandler`).
- Raise `*.Contracts` events from the service, after the write succeeded.

```csharp
public async Task<Result<Site>> UpdateAsync(Site site, CancellationToken ct)
{
    if (site == await GetAsync(site.Id, ct)) return site;   // a no-op PATCH writes nothing
    site.UpdatedAt = time.UtcNow;
    if (!await sites.UpdateAsync(site, ct)) return SlugTaken;
    await RaiseAsync(site, SiteChanged.Updated, ct);
    return site;
}
```

## Data access
- One `<Entity>Repository` per entity, injecting the module's `DbContext`. Small methods named after what they do: `GetAsync`, `ListAsync`, `CountAsync` (taking the filter), `AddAsync`, `UpdateAsync` (taking the entity). No generic repository.
- EF Core maps `<Entity>Dao` classes, never entities. The repository maps DAO ↔ entity with Mapperly; an update maps the entity onto the tracked DAO, so only changed columns are written.
- Always LINQ over the DbSet. No raw SQL, no `FromSql`, no `ExecuteSql`.
- Unique indexes judge uniqueness; the repository catches the violation and returns `false`. It never throws for a business rule.
- Configure DAOs in `OnModelCreating`. Names become snake_case through `UseSnakeCaseNamingConvention()`.
- New migration: `dotnet ef migrations add <Name> --project src/Modules/<Module>/Hivesite.<Module> --output-dir Infrastructure/Migrations`.

## Keep it simple
- Build the spec, nothing more. No idempotency keys, caching, locking or retries until a human asks for them.
- No base classes or generics "for later". Write the specific class; extract only when a second entity really repeats it. Prefer framework features (FluentValidation, Mapperly, EF Core, `TypedResults`) over helpers.

## Tests
- MSTest (`[TestClass]`, `[TestMethod]`, `[DataRow]`). No xUnit.
- Integration tests run over HTTP through `WebApplicationFactory<Program>` against Postgres (`Hivesite.Testing.PostgresFixture`); call `SkipIfUnavailable()` first.
- Validators and mappers get plain unit tests, so most rules run without Docker.
- Name tests as sentences ending in the acceptance criterion: `A_taken_slug_is_refused_AC7`.

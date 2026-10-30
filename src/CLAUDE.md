# C# patterns

How every module is built. Follow these; don't invent new plumbing. The Content module's sites (API-001) are the reference implementation: copy their shape for every new entity.

## Layers and flow

```
HTTP ─► Endpoint ─► Mapper ─► Service ─► Repository ─► DbContext
        (DTO +      (DTO →    (rules,    (one per
        validator)  entity)   entities)  entity)
```

| Folder | Holds | Knows about |
|---|---|---|
| `Endpoints/` | `<Entity>Endpoints`, DTOs, FluentValidation validators, the Mapperly DTO mapper | DTOs, entities, services |
| `Application/` | `<Entity>Service` | entities, its repository |
| `Domain/` | Entities: plain classes that EF Core maps directly | nothing |
| `Infrastructure/` | `DbContext`, `<Entity>Repository`, migrations | entities |

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
- Never map DTOs by hand. One static `[Mapper]` per entity for DTO ↔ entity, in `Endpoints/`.
- DTO mappers use `AllowNullPropertyAssignment = false`, so a PATCH DTO mapped onto an entity changes only what was sent.
- Use `RequiredMappingStrategy.Target` and list skipped targets with `[MapperIgnoreTarget]`, so a new field can't be forgotten silently.

## Services
- One `<Entity>Service` per entity, a plain class. It holds the spec's rules and calls its repository; no base class, no generic service.
- Public methods take and return entities, never DTOs or `IResult`.
- Set ids (`Guid.CreateVersion7()`) and timestamps (`ITimeService`, never `DateTime.UtcNow`) in the service.
- Business rules throw `BusinessRuleException(code, message, field?)` (400) or `NotFoundException` (404). `ApiExceptionHandler` turns them into the error body of `specs/STYLE.md`.
- Raise `*.Contracts` events from the service, after the write succeeded.

```csharp
public async Task<Site> UpdateAsync(Site site, CancellationToken ct)
{
    if (!sites.HasChanges()) return site;   // a no-op PATCH writes nothing
    site.UpdatedAt = time.UtcNow;
    await sites.SaveAsync(ct);
    await RaiseAsync(site, SiteChanged.Updated, ct);
    return site;
}
```

## Data access
- One `<Entity>Repository` per entity, injecting the module's `DbContext`. Small methods named after what they do: `GetAsync`, `ListAsync`, `CountAsync`, `Add`, `SaveAsync`. No generic repository.
- Scope reads in the repository method (`s.OwnerId == ownerId`). `GetAsync` returns a tracked entity, so an update is: get, map the PATCH DTO onto it, save.
- Always LINQ over the DbSet. No raw SQL, no `FromSql`, no `ExecuteSql`.
- Unique indexes judge uniqueness; `SaveAsync` turns the violation into the spec's error.
- Configure entities in `OnModelCreating`. Columns become snake_case automatically.
- New migration: `dotnet ef migrations add <Name> --project src/Modules/<Module>/Hivesite.<Module> --output-dir Infrastructure/Migrations`.

## Keep it simple
- Build the spec, nothing more. No idempotency keys, caching, locking or retries until a human asks for them.
- No base classes or generics "for later". Write the specific class; extract only when a second entity really repeats it. Prefer framework features (FluentValidation, Mapperly, EF Core, `TypedResults`) over helpers.

## Tests
- Integration tests run over HTTP through `WebApplicationFactory<Program>` against Postgres (`Hivesite.Testing.PostgresFixture`); call `SkipIfUnavailable()` first.
- Validators and mappers get plain unit tests, so most rules run without Docker.
- Name tests as sentences ending in the acceptance criterion: `A_taken_slug_is_refused_AC7`.

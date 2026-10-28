using System.Globalization;
using System.Text;
using System.Text.Json;
using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;
using Hivesite.Content.Infrastructure;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Hivesite.Content.Application;

public sealed record SiteSettingsResponse(string Language, string Description);

public sealed record SiteResponse(
    string Id, string Name, string Slug, SiteSettingsResponse Settings, DateTime CreatedAt, DateTime UpdatedAt)
{
    public static SiteResponse From(Site s) =>
        new(s.Id.ToString("D"), s.Name, s.Slug, new SiteSettingsResponse(s.Language, s.Description), s.CreatedAt, s.UpdatedAt);
}

/// <summary>The use cases of API-001. Returns finished results; the endpoints only translate HTTP.</summary>
internal sealed class SiteService(
    ContentDbContext db,
    TimeProvider clock,
    IOptions<JsonOptions> json,
    IEnumerable<ISiteChangedHandler> handlers)
{
    private const int MaxSitesPerOwner = 10;
    private static readonly TimeSpan IdempotencyRetention = TimeSpan.FromHours(24);

    private DateTime Now()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        return new DateTime(now.Ticks - (now.Ticks % TimeSpan.TicksPerSecond), DateTimeKind.Utc);
    }

    public async Task<IResult> CreateAsync(string owner, SiteInput input, string? key, string requestHash, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // One writer per owner at a time: keeps the 10-site limit and idempotency keys race-free.
        await db.Database.ExecuteSqlInterpolatedAsync($"select pg_advisory_xact_lock(hashtext({owner}))", ct);

        var now = Now();
        if (key is not null)
        {
            var cutoff = now - IdempotencyRetention;
            await db.IdempotencyKeys.Where(r => r.OwnerId == owner && r.Key == key && r.CreatedAt <= cutoff).ExecuteDeleteAsync(ct);
            var previous = await db.IdempotencyKeys.AsNoTracking().SingleOrDefaultAsync(r => r.OwnerId == owner && r.Key == key, ct);
            if (previous is not null)
            {
                return previous.RequestHash == requestHash
                    ? Replay(previous)
                    : Http.Error(400, "idempotency_key_reused", "This Idempotency-Key was used with a different body.", "Idempotency-Key");
            }
        }

        if (await db.Sites.CountAsync(s => s.OwnerId == owner, ct) >= MaxSitesPerOwner)
        {
            return Http.Error(400, "too_many_sites", "You can have at most 10 sites.");
        }

        var site = new Site
        {
            Id = Guid.CreateVersion7(),
            OwnerId = owner,
            Name = input.Name!,
            Slug = input.Slug!,
            Language = input.Language ?? "en",
            Description = input.Description ?? "",
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Sites.Add(site);

        var response = SiteResponse.From(site);
        var location = $"/sites/{response.Id}";
        if (key is not null)
        {
            db.IdempotencyKeys.Add(new IdempotencyRecord
            {
                OwnerId = owner,
                Key = key,
                RequestHash = requestHash,
                ResponseBody = JsonSerializer.Serialize(response, json.Value.SerializerOptions),
                Location = location,
                CreatedAt = now,
            });
        }

        if (!await TrySaveAsync(ct))
        {
            return SlugTaken();
        }
        await tx.CommitAsync(ct);
        await RaiseAsync(site, SiteChanged.Created, ct);
        return Results.Created(location, response);
    }

    public async Task<IResult> GetAsync(string owner, Guid id, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().SingleOrDefaultAsync(s => s.Id == id && s.OwnerId == owner, ct);
        return site is null ? Http.SiteNotFound() : Results.Ok(SiteResponse.From(site));
    }

    public async Task<IResult> ListAsync(string owner, int limit, string? cursor, CancellationToken ct)
    {
        List<Site> rows;
        if (cursor is null)
        {
            rows = await db.Sites.FromSql($"""
                select * from content.sites where owner_id = {owner}
                order by created_at desc, id asc limit {limit + 1}
                """).AsNoTracking().ToListAsync(ct);
        }
        else
        {
            if (!TryDecodeCursor(cursor, out var createdAt, out var id))
            {
                return Http.Error(400, "invalid_cursor", "The cursor is not valid.", "cursor");
            }
            rows = await db.Sites.FromSql($"""
                select * from content.sites where owner_id = {owner}
                and (created_at < {createdAt} or (created_at = {createdAt} and id > {id}))
                order by created_at desc, id asc limit {limit + 1}
                """).AsNoTracking().ToListAsync(ct);
        }

        var page = rows.Take(limit).ToList();
        string? next = rows.Count > limit ? EncodeCursor(page[^1]) : null;
        return Results.Ok(new { Items = page.Select(SiteResponse.From), NextCursor = next });
    }

    public async Task<IResult> UpdateAsync(string owner, Guid id, SiteInput input, CancellationToken ct)
    {
        var site = await db.Sites.SingleOrDefaultAsync(s => s.Id == id && s.OwnerId == owner, ct);
        if (site is null)
        {
            return Http.SiteNotFound();
        }

        var changed = false;
        changed |= Set(input.Name, site.Name, v => site.Name = v);
        changed |= Set(input.Slug, site.Slug, v => site.Slug = v);
        changed |= Set(input.Language, site.Language, v => site.Language = v);
        changed |= Set(input.Description, site.Description, v => site.Description = v);
        if (!changed)
        {
            return Results.Ok(SiteResponse.From(site));
        }

        site.UpdatedAt = Now();
        if (!await TrySaveAsync(ct))
        {
            return SlugTaken();
        }
        await RaiseAsync(site, SiteChanged.Updated, ct);
        return Results.Ok(SiteResponse.From(site));
    }

    private static bool Set(string? value, string current, Action<string> assign)
    {
        if (value is null || value == current)
        {
            return false;
        }
        assign(value);
        return true;
    }

    private static IResult SlugTaken() => Http.Error(400, "slug_taken", "Another site already uses this slug.", "/slug");

    private static ReplayResult Replay(IdempotencyRecord record) => new ReplayResult(record.ResponseBody, record.Location);

    /// <summary>False when the unique slug index rejected the write; the database is the judge, not a check in code.</summary>
    private async Task<bool> TrySaveAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ContentDbContext.SlugIndex })
        {
            return false;
        }
    }

    private async Task RaiseAsync(Site site, string change, CancellationToken ct)
    {
        var message = new SiteChanged(site.Id.ToString("D"), change);
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(message, ct);
        }
    }

    private static string EncodeCursor(Site last)
    {
        var payload = JsonSerializer.Serialize(new { c = last.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss'Z'", CultureInfo.InvariantCulture), i = last.Id.ToString("D") });
        return "c_" + Convert.ToBase64String(Encoding.UTF8.GetBytes(payload)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static bool TryDecodeCursor(string cursor, out DateTime createdAt, out Guid id)
    {
        createdAt = default;
        id = default;
        if (!cursor.StartsWith("c_", StringComparison.Ordinal))
        {
            return false;
        }
        try
        {
            var b64 = cursor[2..].Replace('-', '+').Replace('_', '/');
            b64 = b64.PadRight(b64.Length + ((4 - (b64.Length % 4)) % 4), '=');
            using var doc = JsonDocument.Parse(Convert.FromBase64String(b64));
            var root = doc.RootElement;
            return root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("c", out var c) && c.ValueKind == JsonValueKind.String
                && DateTime.TryParseExact(c.GetString(), "yyyy-MM-ddTHH:mm:ss'Z'", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out createdAt)
                && root.TryGetProperty("i", out var i) && i.ValueKind == JsonValueKind.String
                && Guid.TryParseExact(i.GetString(), "D", out id);
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return false;
        }
    }

    /// <summary>201 again with the stored body and Location.</summary>
    private sealed class ReplayResult(string body, string location) : IResult
    {
        public Task ExecuteAsync(HttpContext httpContext)
        {
            httpContext.Response.StatusCode = StatusCodes.Status201Created;
            httpContext.Response.Headers.Location = location;
            httpContext.Response.ContentType = "application/json";
            return httpContext.Response.WriteAsync(body);
        }
    }
}

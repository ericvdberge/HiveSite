using Hivesite.Content.Domain;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hivesite.Content.Infrastructure;

/// <summary>All database access for sites. Every read is scoped to one owner.</summary>
internal sealed class SiteRepository(ContentDbContext db)
{
    /// <summary>Tracked, so changing the site and calling <see cref="SaveAsync"/> updates it.</summary>
    public Task<Site?> GetAsync(string ownerId, Guid id, CancellationToken ct) =>
        db.Sites.SingleOrDefaultAsync(s => s.OwnerId == ownerId && s.Id == id, ct);

    public Task<int> CountAsync(string ownerId, CancellationToken ct) =>
        db.Sites.CountAsync(s => s.OwnerId == ownerId, ct);

    /// <summary>Newest first, ties by id ascending, starting after <paramref name="after"/>.</summary>
    public async Task<Page<Site>> ListAsync(string ownerId, int limit, SiteCursor? after, CancellationToken ct)
    {
        var query = db.Sites.AsNoTracking().Where(s => s.OwnerId == ownerId);
        if (after is not null)
        {
            query = query.Where(s => s.CreatedAt < after.CreatedAt || (s.CreatedAt == after.CreatedAt && s.Id.CompareTo(after.Id) > 0));
        }
        var rows = await query.OrderByDescending(s => s.CreatedAt).ThenBy(s => s.Id).Take(limit + 1).ToListAsync(ct);
        return new Page<Site>(rows.Take(limit).ToList(), rows.Count > limit);
    }

    public void Add(Site site) => db.Sites.Add(site);

    public bool HasChanges() => db.ChangeTracker.HasChanges();

    /// <summary>The unique index judges slugs, so two requests racing for one slug cannot both win.</summary>
    public async Task SaveAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ContentDbContext.SiteSlugIndex })
        {
            throw new BusinessRuleException("slug_taken", "Another site already uses this slug.", "/slug");
        }
    }
}

/// <summary>Where a list of sites continues: after this site.</summary>
public sealed record SiteCursor(DateTime CreatedAt, Guid Id);

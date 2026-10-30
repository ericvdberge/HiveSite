using Hivesite.Content.Domain;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hivesite.Content.Infrastructure;

/// <summary>All database access for sites.</summary>
internal sealed class SiteRepository(ContentDbContext db)
{
    public async Task<Site?> GetAsync(SiteFilter filter, CancellationToken ct) =>
        await Query(filter).AsNoTracking().SingleOrDefaultAsync(ct) is { } dao ? SiteDaoMapper.ToDomain(dao) : null;

    public Task<int> CountAsync(SiteFilter filter, CancellationToken ct) => Query(filter).CountAsync(ct);

    /// <summary>Up to <see cref="SiteFilter.Limit"/> sites, newest first, ties by id ascending.</summary>
    public async Task<Page<Site>> ListAsync(SiteFilter filter, CancellationToken ct)
    {
        var rows = await Query(filter).AsNoTracking()
            .OrderByDescending(s => s.CreatedAt).ThenBy(s => s.Id)
            .Take(filter.Limit + 1)
            .ToListAsync(ct);
        return new Page<Site>(SiteDaoMapper.ToDomain(rows.Take(filter.Limit).ToList()), rows.Count > filter.Limit);
    }

    /// <summary>False when another site already has the slug.</summary>
    public Task<bool> AddAsync(Site site, CancellationToken ct)
    {
        db.Sites.Add(SiteDaoMapper.ToDao(site));
        return SaveAsync(ct);
    }

    /// <summary>False when another site already has the slug.</summary>
    public async Task<bool> UpdateAsync(Site site, CancellationToken ct)
    {
        SiteDaoMapper.Apply(site, await db.Sites.SingleAsync(s => s.Id == site.Id, ct));
        return await SaveAsync(ct);
    }

    private IQueryable<SiteDao> Query(SiteFilter filter)
    {
        var query = db.Sites.AsQueryable();
        if (filter.OwnerId is not null)
        {
            query = query.Where(s => s.OwnerId == filter.OwnerId);
        }
        if (filter.Id is not null)
        {
            query = query.Where(s => s.Id == filter.Id);
        }
        if (filter.After is not null)
        {
            var after = db.Sites.Where(a => a.Id == filter.After);
            query = query.Where(s => after.Any(a => s.CreatedAt < a.CreatedAt || (s.CreatedAt == a.CreatedAt && s.Id.CompareTo(a.Id) > 0)));
        }
        return query;
    }

    /// <summary>The unique index judges slugs, so two requests racing for one slug cannot both win.</summary>
    private async Task<bool> SaveAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ContentDbContext.SiteSlugIndex })
        {
            return false;
        }
    }
}

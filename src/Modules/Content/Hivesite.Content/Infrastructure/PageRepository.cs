using Hivesite.Content.Domain;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hivesite.Content.Infrastructure;

/// <summary>All database access for pages.</summary>
internal sealed class PageRepository(ContentDbContext db)
{
    public async Task<Page?> GetAsync(PageFilter filter, CancellationToken ct) =>
        await Query(filter).AsNoTracking().SingleOrDefaultAsync(ct) is { } dao ? PageDaoMapper.ToDomain(dao) : null;

    public Task<int> CountAsync(PageFilter filter, CancellationToken ct) => Query(filter).CountAsync(ct);

    /// <summary>Up to <see cref="PageFilter.Limit"/> pages by menu order.</summary>
    public async Task<Page<Domain.Page>> ListAsync(PageFilter filter, CancellationToken ct)
    {
        var rows = await Query(filter).AsNoTracking()
            .OrderBy(p => p.MenuOrder)
            .Take(filter.Limit + 1)
            .ToListAsync(ct);
        return new Page<Domain.Page>(PageDaoMapper.ToDomain(rows.Take(filter.Limit).ToList()), rows.Count > filter.Limit);
    }

    /// <summary>False when another page of the site has the slug.</summary>
    public Task<bool> AddAsync(Domain.Page page, CancellationToken ct)
    {
        db.Pages.Add(PageDaoMapper.ToDao(page));
        return SaveAsync(ct);
    }

    /// <summary>False when another page of the site has the slug.</summary>
    public async Task<bool> UpdateAsync(Domain.Page page, CancellationToken ct)
    {
        PageDaoMapper.Apply(page, await db.Pages.SingleAsync(p => p.Id == page.Id, ct));
        return await SaveAsync(ct);
    }

    /// <summary>Deletes the page and moves the pages after it up by one, in one transaction. Their <c>updated_at</c> stays.</summary>
    public async Task DeleteAsync(Domain.Page page, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Pages.Where(p => p.Id == page.Id).ExecuteDeleteAsync(ct);
        await db.Pages.Where(p => p.SiteId == page.SiteId && p.MenuOrder > page.MenuOrder)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.MenuOrder, p => p.MenuOrder - 1), ct);
        await transaction.CommitAsync(ct);
    }

    /// <summary>Gives each page of the site the position of its id in <paramref name="pageIds"/>. One save, so one transaction.</summary>
    public async Task SaveMenuAsync(Guid siteId, IReadOnlyList<Guid> pageIds, CancellationToken ct)
    {
        var order = pageIds.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
        foreach (var row in await db.Pages.Where(p => p.SiteId == siteId).ToListAsync(ct))
        {
            row.MenuOrder = order[row.Id];
        }
        await db.SaveChangesAsync(ct);
    }

    private IQueryable<PageDao> Query(PageFilter filter)
    {
        var query = db.Pages.AsQueryable();
        if (filter.SiteId is not null)
        {
            query = query.Where(p => p.SiteId == filter.SiteId);
        }
        if (filter.Id is not null)
        {
            query = query.Where(p => p.Id == filter.Id);
        }
        if (filter.OwnerId is not null)
        {
            query = query.Where(p => db.Sites.Any(s => s.Id == p.SiteId && s.OwnerId == filter.OwnerId));
        }
        if (filter.After is not null)
        {
            var after = db.Pages.Where(a => a.Id == filter.After);
            query = query.Where(p => after.Any(a => p.MenuOrder > a.MenuOrder));
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
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: ContentDbContext.PageSlugIndex })
        {
            return false;
        }
    }
}

using Hivesite.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hivesite.Content.Infrastructure;

/// <summary>All database access for page blocks. A page without a row has the empty document at version 1; the service knows that.</summary>
internal sealed class PageBlocksRepository(ContentDbContext db)
{
    public async Task<PageBlocks?> GetAsync(PageBlocksFilter filter, CancellationToken ct)
    {
        var query = db.PageBlocks.AsQueryable();
        if (filter.PageId is not null)
        {
            query = query.Where(b => b.PageId == filter.PageId);
        }
        if (filter.OwnerId is not null)
        {
            query = query.Where(b => db.Pages.Any(p => p.Id == b.PageId && db.Sites.Any(s => s.Id == p.SiteId && s.OwnerId == filter.OwnerId)));
        }
        return await query.AsNoTracking().SingleOrDefaultAsync(ct) is { } dao ? PageBlocksDaoMapper.ToDomain(dao) : null;
    }

    /// <summary>
    /// Writes the document, the next version and the page's <c>updated_at</c> in one transaction. With <paramref name="expectedVersion"/>
    /// it writes only if that is the stored version; without, whatever is stored is overwritten. False when the version moved on.
    /// </summary>
    public async Task<bool> SaveAsync(PageBlocks blocks, int? expectedVersion, DateTime updatedAt, CancellationToken ct)
    {
        var dao = PageBlocksDaoMapper.ToDao(blocks);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var rows = await db.PageBlocks
            .Where(b => b.PageId == blocks.PageId && (expectedVersion == null || b.Version == expectedVersion))
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Document, dao.Document).SetProperty(b => b.Version, b => b.Version + 1), ct);
        if (rows == 0 && !await AddFirstAsync(dao, expectedVersion, ct))
        {
            return false;
        }

        await db.Pages.Where(p => p.Id == blocks.PageId).ExecuteUpdateAsync(s => s.SetProperty(p => p.UpdatedAt, updatedAt), ct);
        await transaction.CommitAsync(ct);
        return true;
    }

    /// <summary>The first save of a page: no row yet means version 1, so the row starts at 2. The primary key settles a race.</summary>
    private async Task<bool> AddFirstAsync(PageBlocksDao dao, int? expectedVersion, CancellationToken ct)
    {
        if (expectedVersion is not (null or 1) || await db.PageBlocks.AnyAsync(b => b.PageId == dao.PageId, ct))
        {
            return false;
        }

        dao.Version = 2;
        db.PageBlocks.Add(dao);
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            db.Entry(dao).State = EntityState.Detached;
            return false;
        }
    }
}

using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;

namespace Hivesite.Content.Application;

/// <summary>Where a list of sites continues: after this site, newest first.</summary>
public sealed record SiteCursor(DateTime CreatedAt, Guid Id);

/// <summary>The rules of API-001. Every read and write is scoped to the current owner.</summary>
internal sealed class SiteService(IRepository<Site> repository, ICurrentOwner owner, IEnumerable<ISiteChangedHandler> handlers)
    : EntityService<Site>(repository)
{
    public const int MaxSitesPerOwner = 10;

    private string OwnerId => owner.RequiredId();

    protected override IQueryable<Site> Query
    {
        get
        {
            var ownerId = OwnerId;
            return Repository.Query.Where(s => s.OwnerId == ownerId);
        }
    }

    protected override NotFoundException NotFound() => new("site_not_found", "No site with this id.");

    /// <summary>Newest first, ties by id ascending.</summary>
    public Task<Page<Site>> ListAsync(int limit, SiteCursor? after, CancellationToken cancellationToken)
    {
        var query = Query;
        if (after is not null)
        {
            query = query.Where(s => s.CreatedAt < after.CreatedAt || (s.CreatedAt == after.CreatedAt && s.Id.CompareTo(after.Id) > 0));
        }
        return PageAsync(query.OrderByDescending(s => s.CreatedAt).ThenBy(s => s.Id), limit, cancellationToken);
    }

    public override async Task<Site> CreateAsync(Site site, CancellationToken cancellationToken)
    {
        if (await Query.CountAsync(cancellationToken) >= MaxSitesPerOwner)
        {
            throw new BusinessRuleException("too_many_sites", $"You can have at most {MaxSitesPerOwner} sites.");
        }

        site.OwnerId = OwnerId;
        var created = await SaveAsync(() => Repository.AddAsync(site, cancellationToken));
        await RaiseAsync(created, SiteChanged.Created, cancellationToken);
        return created;
    }

    public override async Task<Site> UpdateAsync(Site site, CancellationToken cancellationToken)
    {
        if (site.OwnerId != OwnerId)
        {
            throw NotFound();
        }

        var (updated, changed) = await SaveAsync(() => Repository.UpdateAsync(site, cancellationToken));
        if (changed)
        {
            await RaiseAsync(updated, SiteChanged.Updated, cancellationToken);
        }
        return updated;
    }

    /// <summary>The unique index judges slugs, so two requests racing for one slug cannot both win.</summary>
    private static async Task<T> SaveAsync<T>(Func<Task<T>> save)
    {
        try
        {
            return await save();
        }
        catch (DbUpdateException e) when (e.IsUniqueViolation(SiteDao.SlugIndex))
        {
            throw new BusinessRuleException("slug_taken", "Another site already uses this slug.", "/slug");
        }
    }

    private async Task RaiseAsync(Site site, string change, CancellationToken cancellationToken)
    {
        var message = new SiteChanged(site.Id.ToString("D"), change);
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(message, cancellationToken);
        }
    }
}

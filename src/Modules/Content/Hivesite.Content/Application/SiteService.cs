using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>The rules of API-001, for the current owner.</summary>
internal sealed class SiteService(SiteRepository sites, ICurrentOwner owner, ITimeService time, IEnumerable<ISiteChangedHandler> handlers)
{
    public const int MaxSitesPerOwner = 10;

    public async Task<Site> GetAsync(Guid id, CancellationToken ct) =>
        await sites.GetAsync(owner.RequiredId(), id, ct)
        ?? throw new NotFoundException("site_not_found", "No site with this id.");

    public Task<Page<Site>> ListAsync(int limit, SiteCursor? after, CancellationToken ct) =>
        sites.ListAsync(owner.RequiredId(), limit, after, ct);

    public async Task<Site> CreateAsync(Site site, CancellationToken ct)
    {
        if (await sites.CountAsync(owner.RequiredId(), ct) >= MaxSitesPerOwner)
        {
            throw new BusinessRuleException("too_many_sites", $"You can have at most {MaxSitesPerOwner} sites.");
        }

        site.Id = Guid.CreateVersion7();
        site.OwnerId = owner.RequiredId();
        site.CreatedAt = site.UpdatedAt = time.UtcNow;
        sites.Add(site);
        await sites.SaveAsync(ct);
        await RaiseAsync(site, SiteChanged.Created, ct);
        return site;
    }

    /// <summary>Saves a site from <see cref="GetAsync"/> after the caller changed it. A no-op change writes and raises nothing.</summary>
    public async Task<Site> UpdateAsync(Site site, CancellationToken ct)
    {
        if (!sites.HasChanges())
        {
            return site;
        }

        site.UpdatedAt = time.UtcNow;
        await sites.SaveAsync(ct);
        await RaiseAsync(site, SiteChanged.Updated, ct);
        return site;
    }

    private async Task RaiseAsync(Site site, string change, CancellationToken ct)
    {
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(new SiteChanged(site.Id.ToString("D"), change), ct);
        }
    }
}

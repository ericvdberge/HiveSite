using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>The rules of API-001, for the signed-in owner.</summary>
internal sealed class SiteService(SiteRepository sites, UserContext user, ITimeService time, IEnumerable<ISiteChangedHandler> handlers)
{
    public const int MaxSitesPerOwner = 10;

    private static readonly Error SlugTaken = new("slug_taken", "Another site already uses this slug.", "/slug");

    /// <summary>Null when the site does not exist or belongs to another owner.</summary>
    public Task<Site?> GetAsync(Guid id, CancellationToken ct) =>
        sites.GetAsync(new SiteFilter { OwnerId = user.Id, Id = id }, ct);

    public async Task<Result<Page<Site>>> ListAsync(SiteFilter filter, CancellationToken ct)
    {
        filter = filter with { OwnerId = user.Id };
        if (filter.After is { } after && await GetAsync(after, ct) is null)
        {
            return new Error("invalid_cursor", "The cursor is not valid.", "cursor");
        }
        return await sites.ListAsync(filter, ct);
    }

    public async Task<Result<Site>> CreateAsync(Site site, CancellationToken ct)
    {
        if (await sites.CountAsync(new SiteFilter { OwnerId = user.Id }, ct) >= MaxSitesPerOwner)
        {
            return new Error("too_many_sites", $"You can have at most {MaxSitesPerOwner} sites.");
        }

        site.Id = Guid.CreateVersion7();
        site.OwnerId = user.Id;
        site.CreatedAt = site.UpdatedAt = time.UtcNow;
        if (!await sites.AddAsync(site, ct))
        {
            return SlugTaken;
        }
        await RaiseAsync(site, SiteChanged.Created, ct);
        return site;
    }

    /// <summary>Saves a site from <see cref="GetAsync"/> after the caller changed it. A change to nothing writes and raises nothing.</summary>
    public async Task<Result<Site>> UpdateAsync(Site site, CancellationToken ct)
    {
        if (site == await GetAsync(site.Id, ct))
        {
            return site;
        }

        site.UpdatedAt = time.UtcNow;
        if (!await sites.UpdateAsync(site, ct))
        {
            return SlugTaken;
        }
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

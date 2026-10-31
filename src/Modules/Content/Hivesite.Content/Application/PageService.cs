using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>
/// The rules of API-002, for the signed-in owner. Methods that take a <c>siteId</c> expect the caller to have checked
/// the site with <see cref="SiteService.GetAsync"/>; methods that take a page are scoped to the owner here.
/// </summary>
internal sealed class PageService(
    PageRepository pages,
    UserContext user,
    ITimeService time,
    IEnumerable<IPageChangedHandler> pageHandlers,
    IEnumerable<IMenuChangedHandler> menuHandlers)
{
    public const int MaxPagesPerSite = 50;
    public const string ReservedSlug = "assets";

    private static readonly Error SlugTaken = new("slug_taken", "Another page of this site already uses this slug.", "/slug");
    private static readonly Error SlugReserved = new("slug_reserved", "This slug is reserved.", "/slug");

    /// <summary>Null when the page does not exist or its site belongs to another owner.</summary>
    public Task<Page?> GetAsync(Guid id, CancellationToken ct) =>
        pages.GetAsync(new PageFilter { OwnerId = user.Id, Id = id }, ct);

    public async Task<Result<Page<Page>>> ListAsync(PageFilter filter, CancellationToken ct)
    {
        if (filter.After is { } after && await pages.GetAsync(new PageFilter { SiteId = filter.SiteId, Id = after }, ct) is null)
        {
            return new Error("invalid_cursor", "The cursor is not valid.", "cursor");
        }
        return await pages.ListAsync(filter, ct);
    }

    /// <summary>Adds the page at the end of the menu of <c>page.SiteId</c>.</summary>
    public async Task<Result<Page>> CreateAsync(Page page, CancellationToken ct)
    {
        if (page.Slug == ReservedSlug)
        {
            return SlugReserved;
        }

        var count = await pages.CountAsync(new PageFilter { SiteId = page.SiteId }, ct);
        if (count >= MaxPagesPerSite)
        {
            return new Error("too_many_pages", $"A site can have at most {MaxPagesPerSite} pages.");
        }

        page.Id = Guid.CreateVersion7();
        page.MenuOrder = count;
        page.CreatedAt = page.UpdatedAt = time.UtcNow;
        if (!await pages.AddAsync(page, ct))
        {
            return SlugTaken;
        }
        await RaiseAsync(PageChanged.Created, page, ct);
        await RaiseMenuAsync(page.SiteId, ct);
        return page;
    }

    /// <summary>Saves a page from <see cref="GetAsync"/> after the caller changed it. A change to nothing writes and raises nothing.</summary>
    public async Task<Result<Page>> UpdateAsync(Page page, CancellationToken ct)
    {
        if (page == await GetAsync(page.Id, ct))
        {
            return page;
        }
        if (page.Slug == ReservedSlug)
        {
            return SlugReserved;
        }

        page.UpdatedAt = time.UtcNow;
        if (!await pages.UpdateAsync(page, ct))
        {
            return SlugTaken;
        }
        await RaiseAsync(PageChanged.Updated, page, ct);
        return page;
    }

    /// <summary>Deletes the page of the signed-in owner. False when there is none.</summary>
    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct)
    {
        if (await GetAsync(id, ct) is not { } page)
        {
            return false;
        }

        await pages.DeleteAsync(page, ct);
        await RaiseAsync(PageChanged.Deleted, page, ct);
        await RaiseMenuAsync(page.SiteId, ct);
        return true;
    }

    /// <summary>Orders the pages of the site as <paramref name="pageIds"/>, which must list each page once. Returns the pages in the new order.</summary>
    public async Task<Result<List<Page>>> ReplaceMenuAsync(Guid siteId, IReadOnlyList<Guid> pageIds, CancellationToken ct)
    {
        var current = (await pages.ListAsync(new PageFilter { SiteId = siteId, Limit = MaxPagesPerSite }, ct)).Items.ToList();
        if (!current.Select(p => p.Id).Order().SequenceEqual(pageIds.Order()))
        {
            return new Error("menu_mismatch", "page_ids must list each page of the site exactly once.", "/page_ids");
        }
        if (current.Select(p => p.Id).SequenceEqual(pageIds))
        {
            return current;
        }

        await pages.SaveMenuAsync(siteId, pageIds, ct);
        await RaiseMenuAsync(siteId, ct);
        return (await pages.ListAsync(new PageFilter { SiteId = siteId, Limit = MaxPagesPerSite }, ct)).Items.ToList();
    }

    private async Task RaiseAsync(string change, Page page, CancellationToken ct)
    {
        foreach (var handler in pageHandlers)
        {
            await handler.HandleAsync(new PageChanged(page.Id.ToString("D"), page.SiteId.ToString("D"), change), ct);
        }
    }

    private async Task RaiseMenuAsync(Guid siteId, CancellationToken ct)
    {
        var ids = (await pages.ListAsync(new PageFilter { SiteId = siteId, Limit = MaxPagesPerSite }, ct)).Items
            .Select(p => p.Id.ToString("D")).ToList();
        foreach (var handler in menuHandlers)
        {
            await handler.HandleAsync(new MenuChanged(siteId.ToString("D"), ids), ct);
        }
    }
}

using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;

namespace Hivesite.Content.Application;

/// <summary>
/// The snapshot of API-011 for the signed-in owner. It composes the repositories of the three entities inside one Repeatable Read
/// transaction, so the site, its pages and their blocks belong to the same moment. It writes nothing.
/// </summary>
internal sealed class SiteSnapshotService(
    SiteService sites,
    PageService pages,
    PageRepository pageRepository,
    PageBlocksRepository blocks,
    ContentTransaction transaction)
{
    /// <summary>Null when the site does not exist or belongs to another owner.</summary>
    public Task<SiteSnapshot?> GetAsync(Guid siteId, CancellationToken ct) =>
        transaction.ReadAsync(() => ReadAsync(siteId, ct), ct);

    /// <summary>The snapshot of the site that holds the page. Null when the page does not exist or its site is not the owner's.</summary>
    public Task<SiteSnapshot?> GetForPageAsync(Guid pageId, CancellationToken ct) =>
        transaction.ReadAsync(async () => await pages.GetAsync(pageId, ct) is { } page ? await ReadAsync(page.SiteId, ct) : null, ct);

    private async Task<SiteSnapshot?> ReadAsync(Guid siteId, CancellationToken ct)
    {
        if (await sites.GetAsync(siteId, ct) is not { } site)
        {
            return null;
        }

        var list = await pageRepository.ListAsync(new PageFilter { SiteId = siteId, Limit = PageService.MaxPagesPerSite }, ct);
        var stored = (await blocks.ListAsync(new PageBlocksFilter { SiteId = siteId }, ct)).ToDictionary(b => b.PageId);
        return new SiteSnapshot(site, list.Items.Select(p => new SnapshotPage(p, stored.GetValueOrDefault(p.Id) ?? PageBlocks.Empty(p.Id))).ToList());
    }
}

using Hivesite.Content.Contracts;
using Hivesite.Content.Infrastructure;

namespace Hivesite.Content.Application;

/// <summary>What other modules get from <see cref="IContentApi"/>: contract DTOs, never the internal records.</summary>
internal sealed class ContentModuleApi(BlockTypeRegistry registry, SiteSnapshotService snapshots) : IContentApi
{
    public Task<IReadOnlyList<BlockTypeInfo>> ListBlockTypesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(ContentApiMapper.ToInfo(registry.All));

    public async Task<SiteSnapshot?> GetSiteSnapshotAsync(Guid siteId, CancellationToken cancellationToken = default) =>
        await snapshots.GetAsync(siteId, cancellationToken) is { } snapshot ? ContentApiMapper.ToContract(snapshot) : null;

    public async Task<SiteSnapshot?> GetSiteSnapshotForPageAsync(Guid pageId, CancellationToken cancellationToken = default) =>
        await snapshots.GetForPageAsync(pageId, cancellationToken) is { } snapshot ? ContentApiMapper.ToContract(snapshot) : null;
}

using Hivesite.Content.Contracts;
using Hivesite.Content.Infrastructure;

namespace Hivesite.Content.Application;

/// <summary>What other modules get from <see cref="IContentApi"/>: contract DTOs, never the internal records.</summary>
internal sealed class ContentModuleApi(BlockTypeRegistry registry) : IContentApi
{
    public Task<IReadOnlyList<BlockTypeInfo>> ListBlockTypesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(ContentApiMapper.ToInfo(registry.All));
}

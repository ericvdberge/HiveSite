using Hivesite.Content.Contracts;
using Hivesite.Content.Endpoints;
using Hivesite.Content.Infrastructure;

namespace Hivesite.Content.Application;

/// <summary>What other modules get from <see cref="IBlockTypeApi"/>: the registry as contract DTOs, never the internal records.</summary>
internal sealed class BlockTypeModuleApi(BlockTypeRegistry registry) : IBlockTypeApi
{
    public Task<IReadOnlyList<BlockTypeInfo>> ListBlockTypesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(BlockTypeMapper.ToInfo(registry.All));
}

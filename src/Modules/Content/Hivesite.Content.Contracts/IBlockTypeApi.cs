using System.Text.Json;

namespace Hivesite.Content.Contracts;

/// <summary>The block type registry of API-003, for other modules. The same seven types and schemas as <c>GET /block-types</c>.</summary>
public interface IBlockTypeApi
{
    /// <summary>All block types in the fixed order of API-003.</summary>
    Task<IReadOnlyList<BlockTypeInfo>> ListBlockTypesAsync(CancellationToken cancellationToken = default);
}

/// <summary>One block type. <c>Schema</c> is the complete JSON Schema (draft 2020-12) of a whole node.</summary>
public sealed record BlockTypeInfo(string Type, string Name, string Description, int Version, JsonElement Schema);

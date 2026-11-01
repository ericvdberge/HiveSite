using Hivesite.Content.Domain;
using Hivesite.Shared;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Endpoints;

/// <summary><see cref="BlockType"/> to its response DTO, and the query to its filter.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class BlockTypeMapper
{
    public static partial BlockTypeDto ToDto(BlockType blockType);

    public static partial IReadOnlyList<BlockTypeDto> ToDto(IReadOnlyList<BlockType> blockTypes);

    public static partial BlockTypeFilter ToFilter(BlockTypeQuery query);

    public static PageDto<BlockTypeDto> ToDto(Page<BlockType> page) =>
        new(ToDto(page.Items), page.HasMore ? page.Items[^1].Type : null);
}

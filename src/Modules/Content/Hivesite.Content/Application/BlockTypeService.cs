using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>The rules of API-003: the block types are the same for every owner, listed in registry order and paged by <c>type</c>.</summary>
internal sealed class BlockTypeService(BlockTypeRegistry registry)
{
    public Result<Page<BlockType>> List(BlockTypeFilter filter)
    {
        var skip = 0;
        if (filter.Cursor is not null)
        {
            var index = registry.All.ToList().FindIndex(t => t.Type == filter.Cursor);
            if (index < 0)
            {
                return new Error("invalid_cursor", "The cursor is not valid.", "cursor");
            }
            skip = index + 1;
        }

        var rest = registry.All.Skip(skip).ToList();
        return new Page<BlockType>(rest.Take(filter.Limit).ToList(), rest.Count > filter.Limit);
    }
}

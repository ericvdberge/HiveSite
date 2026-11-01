using Hivesite.Content.Application;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Hivesite.Content.Endpoints;

/// <summary>API-003. Read only: there is no route to add, change or remove a block type.</summary>
internal static class BlockTypeEndpoints
{
    public static void MapBlockTypeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var blockTypes = endpoints.MapGroup("/block-types").RequireAuthorization();
        blockTypes.MapGet("", ListBlockTypes).Validate<BlockTypeQueryValidator>();
    }

    private static Results<Ok<PageDto<BlockTypeDto>>, BadRequest<ApiError>> ListBlockTypes([AsParameters] BlockTypeQuery query, BlockTypeService service)
    {
        var result = service.List(BlockTypeMapper.ToFilter(query));
        return result.IsSuccess ? TypedResults.Ok(BlockTypeMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }
}

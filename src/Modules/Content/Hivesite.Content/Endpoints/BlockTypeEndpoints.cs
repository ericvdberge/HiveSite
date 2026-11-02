using Hivesite.Content.Application;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Metadata;

namespace Hivesite.Content.Endpoints;

/// <summary>API-003. Read only: there is no route to add, change or remove a block type.</summary>
internal static class BlockTypeEndpoints
{
    public static void MapBlockTypeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var blockTypes = endpoints.MapGroup("/block-types").RequireAuthorization();
        blockTypes.WithTags("Block types");
        blockTypes.WithMetadata(new ProducesResponseTypeMetadata(StatusCodes.Status401Unauthorized, typeof(ApiError), ["application/json"]));   // RequireAuthorization answers it
        blockTypes.MapGet("", ListBlockTypes).Validate<BlockTypeQueryValidator>().WithName("ListBlockTypes")
            .WithSummary("List the block types")
            .WithDescription("The seven block types with their JSON schemas. Errors: 400 `invalid_request`, 400 `invalid_cursor`, 401 `unauthenticated`.");
    }

    private static Results<Ok<PageDto<BlockTypeDto>>, BadRequest<ApiError>> ListBlockTypes([AsParameters] BlockTypeQuery query, BlockTypeService service)
    {
        var result = service.List(BlockTypeMapper.ToFilter(query));
        return result.IsSuccess ? TypedResults.Ok(BlockTypeMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }
}

using System.Text.Json.Nodes;
using Hivesite.Content.Application;
using Hivesite.Content.Domain;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Metadata;

namespace Hivesite.Content.Endpoints;

/// <summary>
/// API-004, GET and PUT. The blocks are one open Tiptap document, so the handlers take the raw body (see <see cref="PageBlocksRequest"/>)
/// instead of a DTO and there is no FluentValidation validator: the body and header failures are 413, 415 and 412, which the validation filter
/// (always 400) cannot answer. The schema checks are <see cref="BlockDocumentValidator"/>.
/// </summary>
internal static class PageBlocksEndpoints
{
    private static readonly ApiError PageNotFound = ApiError.Of("page_not_found", "No page with this id.");
    private static readonly ProducesResponseTypeMetadata Unauthenticated = new(StatusCodes.Status401Unauthorized, typeof(ApiError), ["application/json"]);   // RequireAuthorization answers it

    public static void MapPageBlocksEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var blocks = endpoints.MapGroup("/pages/{id:guid}/blocks").RequireAuthorization();
        blocks.WithTags("Pages");
        blocks.WithMetadata(Unauthenticated);
        blocks.MapGet("", GetPageBlocks).WithName("GetPageBlocks")
            .WithSummary("Get the blocks of a page")
            .WithDescription("A Tiptap document with `ETag: \"<version>\"`; a new page has an empty `content` and `ETag: \"1\"`. Errors: 401 `unauthenticated`, 404 `page_not_found`.")
            .Produces<PageBlocksDocumentDto>();
        blocks.MapPut("", ReplacePageBlocks).WithName("ReplacePageBlocks")
            .WithSummary("Replace the blocks of a page")
            .WithDescription("Replaces the whole document, with defaults filled in. Send `If-Match` with the last `ETag` to refuse a stale write. "
                + "Errors: 400 `invalid_request`, 400 `unknown_block_type`, 400 `invalid_block`, 400 `too_many_blocks`, 401 `unauthenticated`, 404 `page_not_found`, "
                + "412 `precondition_failed`, 413 `request_too_large`, 415 `unsupported_media_type`.")
            .Accepts<PageBlocksDocumentDto>("application/json", "*/*")   // "*/*": routing must not answer another media type itself; the reader answers 415 in our error shape
            .Produces<PageBlocksDocumentDto>()
            .Produces<ApiError>(StatusCodes.Status412PreconditionFailed)
            .Produces<ApiError>(StatusCodes.Status413PayloadTooLarge)
            .Produces<ApiError>(StatusCodes.Status415UnsupportedMediaType);
        // An id that is no UUID names no page: the same 404 as a missing one (API-001 Ids). Not in the document: the routes above say it.
        endpoints.MapGroup("/pages").RequireAuthorization()
            .MapMethods("{id}/blocks", [HttpMethods.Get, HttpMethods.Put], () => TypedResults.NotFound(PageNotFound)).ExcludeFromDescription();
    }

    private static async Task<Results<Ok<JsonObject>, NotFound<ApiError>>> GetPageBlocks(Guid id, HttpResponse response, PageBlocksService service, CancellationToken ct)
    {
        if (await service.GetAsync(id, ct) is not { } blocks)
        {
            return TypedResults.NotFound(PageNotFound);
        }

        response.Headers.ETag = PageBlocksRequest.ETag(blocks.Version);
        return TypedResults.Ok(blocks.Document);
    }

    private static async Task<Results<Ok<JsonObject>, NotFound<ApiError>, BadRequest<ApiError>, JsonHttpResult<ApiError>>> ReplacePageBlocks(
        Guid id,
        HttpRequest httpRequest,
        HttpResponse response,
        PageBlocksService service,
        CancellationToken ct)
    {
        var request = await PageBlocksRequest.ReadAsync(httpRequest, "application/json", ct);
        if (request.Rejection is { } rejection)
        {
            return rejection;
        }

        var result = await service.ReplaceAsync(id, request.Document, request.ExpectedVersion, ct);
        return result switch
        {
            null => TypedResults.NotFound(PageNotFound),
            { IsSuccess: true } => Written(result.Value, response),
            { Error.Code: "precondition_failed" } => TypedResults.Json(new ApiError(result.Error), statusCode: StatusCodes.Status412PreconditionFailed),
            _ => TypedResults.BadRequest(new ApiError(result.Error)),
        };
    }

    private static Ok<JsonObject> Written(PageBlocks blocks, HttpResponse response)
    {
        response.Headers.ETag = PageBlocksRequest.ETag(blocks.Version);
        return TypedResults.Ok(blocks.Document);
    }
}

using Hivesite.Content.Application;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Metadata;

namespace Hivesite.Content.Endpoints;

/// <summary>API-002. Each handler maps the DTO, calls <see cref="PageService"/> and maps the result back. Nothing more.</summary>
internal static class PageEndpoints
{
    private static readonly ApiError SiteNotFound = ApiError.Of("site_not_found", "No site with this id.");
    private static readonly ProducesResponseTypeMetadata Unauthenticated = new(StatusCodes.Status401Unauthorized, typeof(ApiError), ["application/json"]);   // RequireAuthorization answers it
    private static readonly ApiError PageNotFound = ApiError.Of("page_not_found", "No page with this id.");

    public static void MapPageEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var sites = endpoints.MapGroup("/sites").RequireAuthorization();
        sites.WithTags("Pages");
        sites.WithMetadata(Unauthenticated);
        sites.MapPost("{id:guid}/pages", CreatePage).Validate<PagePostValidator>().WithName("CreatePage")
            .WithSummary("Create a page")
            .WithDescription("Errors: 400 `invalid_request`, 400 `slug_taken`, 400 `slug_reserved`, 400 `too_many_pages`, 401 `unauthenticated`, 404 `site_not_found`.");
        sites.MapGet("{id:guid}/pages", ListPages).Validate<PageQueryValidator>().WithName("ListPages")
            .WithSummary("List the pages of a site")
            .WithDescription("Errors: 400 `invalid_request`, 400 `invalid_cursor`, 401 `unauthenticated`, 404 `site_not_found`.");
        sites.MapPut("{id:guid}/menu", ReplaceMenu).Validate<MenuPutValidator>().WithName("ReplaceMenu")
            .WithSummary("Replace the order of the menu")
            .WithDescription("Errors: 400 `invalid_request`, 400 `menu_mismatch`, 401 `unauthenticated`, 404 `site_not_found`.");
        // An id that is no UUID names no site: the same 404 as a missing one (API-001 Ids). Not in the document: the routes above say it.
        sites.MapMethods("{id}/pages", [HttpMethods.Post, HttpMethods.Get], () => TypedResults.NotFound(SiteNotFound)).ExcludeFromDescription();
        sites.MapPut("{id}/menu", () => TypedResults.NotFound(SiteNotFound)).ExcludeFromDescription();

        var pages = endpoints.MapGroup("/pages").RequireAuthorization();
        pages.WithTags("Pages");
        pages.WithMetadata(Unauthenticated);
        pages.MapGet("{id:guid}", GetPage).WithName("GetPage")
            .WithSummary("Get a page")
            .WithDescription("Errors: 401 `unauthenticated`, 404 `page_not_found`.");
        pages.MapPatch("{id:guid}", UpdatePage).Validate<PagePatchValidator>().WithName("UpdatePage")
            .WithSummary("Update a page")
            .WithDescription("Errors: 400 `invalid_request`, 400 `slug_taken`, 400 `slug_reserved`, 401 `unauthenticated`, 404 `page_not_found`.");
        pages.MapDelete("{id:guid}", DeletePage).WithName("DeletePage")
            .WithSummary("Delete a page")
            .WithDescription("Errors: 401 `unauthenticated`, 404 `page_not_found`.");
        pages.MapMethods("{id}", [HttpMethods.Get, HttpMethods.Patch, HttpMethods.Delete], () => TypedResults.NotFound(PageNotFound)).ExcludeFromDescription();
    }

    private static async Task<Results<Created<PageDto>, NotFound<ApiError>, BadRequest<ApiError>>> CreatePage(
        Guid id, PagePostDto dto, SiteService sites, PageService service, CancellationToken ct)
    {
        if (await sites.GetAsync(id, ct) is null)
        {
            return TypedResults.NotFound(SiteNotFound);
        }

        var result = await service.CreateAsync(PageMapper.ToEntity(dto, id), ct);
        return result.IsSuccess
            ? TypedResults.Created($"/pages/{result.Value.Id}", PageMapper.ToDto(result.Value))
            : TypedResults.BadRequest(new ApiError(result.Error));
    }

    private static async Task<Results<Ok<PageDto<PageDto>>, NotFound<ApiError>, BadRequest<ApiError>>> ListPages(
        Guid id, [AsParameters] PageQuery query, SiteService sites, PageService service, CancellationToken ct)
    {
        if (await sites.GetAsync(id, ct) is null)
        {
            return TypedResults.NotFound(SiteNotFound);
        }

        var result = await service.ListAsync(PageMapper.ToFilter(query, id), ct);
        return result.IsSuccess ? TypedResults.Ok(PageMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }

    private static async Task<Results<Ok<PageDto>, NotFound<ApiError>>> GetPage(Guid id, PageService service, CancellationToken ct) =>
        await service.GetAsync(id, ct) is { } page ? TypedResults.Ok(PageMapper.ToDto(page)) : TypedResults.NotFound(PageNotFound);

    private static async Task<Results<Ok<PageDto>, NotFound<ApiError>, BadRequest<ApiError>>> UpdatePage(
        Guid id, PagePatchDto dto, PageService service, CancellationToken ct)
    {
        if (await service.GetAsync(id, ct) is not { } page)
        {
            return TypedResults.NotFound(PageNotFound);
        }

        PageMapper.Apply(dto, page);
        var result = await service.UpdateAsync(page, ct);
        return result.IsSuccess ? TypedResults.Ok(PageMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }

    private static async Task<Results<NoContent, NotFound<ApiError>>> DeletePage(Guid id, PageService service, CancellationToken ct) =>
        await service.DeleteAsync(id, ct) ? TypedResults.NoContent() : TypedResults.NotFound(PageNotFound);

    private static async Task<Results<Ok<MenuDto>, NotFound<ApiError>, BadRequest<ApiError>>> ReplaceMenu(
        Guid id, MenuPutDto dto, SiteService sites, PageService service, CancellationToken ct)
    {
        if (await sites.GetAsync(id, ct) is null)
        {
            return TypedResults.NotFound(SiteNotFound);
        }

        var result = await service.ReplaceMenuAsync(id, dto.PageIds!, ct);
        return result.IsSuccess ? TypedResults.Ok(PageMapper.ToMenuDto(id, result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }
}

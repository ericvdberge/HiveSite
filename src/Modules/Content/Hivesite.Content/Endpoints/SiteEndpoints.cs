using Hivesite.Content.Application;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Metadata;

namespace Hivesite.Content.Endpoints;

/// <summary>API-001. Each handler maps the DTO, calls <see cref="SiteService"/> and maps the result back. Nothing more.</summary>
internal static class SiteEndpoints
{
    private static readonly ApiError SiteNotFound = ApiError.Of("site_not_found", "No site with this id.");

    public static void MapSiteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var sites = endpoints.MapGroup("/sites").RequireAuthorization();
        sites.WithTags("Sites");
        sites.WithMetadata(new ProducesResponseTypeMetadata(StatusCodes.Status401Unauthorized, typeof(ApiError), ["application/json"]));   // RequireAuthorization answers it
        sites.MapPost("", CreateSite).Validate<SitePostValidator>().WithName("CreateSite")
            .WithSummary("Create a site")
            .WithDescription("Errors: 400 `invalid_request`, 400 `slug_taken`, 400 `too_many_sites`, 401 `unauthenticated`.");
        sites.MapGet("", ListSites).Validate<PageQueryValidator>().WithName("ListSites")
            .WithSummary("List the owner's sites, newest first")
            .WithDescription("Errors: 400 `invalid_request`, 400 `invalid_cursor`, 401 `unauthenticated`.");
        sites.MapGet("{id:guid}", GetSite).WithName("GetSite")
            .WithSummary("Get a site")
            .WithDescription("Errors: 401 `unauthenticated`, 404 `site_not_found`.");
        sites.MapPatch("{id:guid}", UpdateSite).Validate<SitePatchValidator>().WithName("UpdateSite")
            .WithSummary("Update a site")
            .WithDescription("Errors: 400 `invalid_request`, 400 `slug_taken`, 401 `unauthenticated`, 404 `site_not_found`.");
        // An id that is no UUID names no site: the same 404 as a missing one (API-001 Ids). Not part of the document: GetSite and UpdateSite say it.
        sites.MapMethods("{id}", [HttpMethods.Get, HttpMethods.Patch], () => TypedResults.NotFound(SiteNotFound)).ExcludeFromDescription();
    }

    private static async Task<Results<Created<SiteDto>, BadRequest<ApiError>>> CreateSite(SitePostDto dto, SiteService service, CancellationToken ct)
    {
        var result = await service.CreateAsync(SiteMapper.ToEntity(dto), ct);
        return result.IsSuccess
            ? TypedResults.Created($"/sites/{result.Value.Id}", SiteMapper.ToDto(result.Value))
            : TypedResults.BadRequest(new ApiError(result.Error));
    }

    private static async Task<Results<Ok<PageDto<SiteDto>>, BadRequest<ApiError>>> ListSites([AsParameters] PageQuery query, SiteService service, CancellationToken ct)
    {
        var result = await service.ListAsync(SiteMapper.ToFilter(query), ct);
        return result.IsSuccess ? TypedResults.Ok(SiteMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }

    private static async Task<Results<Ok<SiteDto>, NotFound<ApiError>>> GetSite(Guid id, SiteService service, CancellationToken ct) =>
        await service.GetAsync(id, ct) is { } site ? TypedResults.Ok(SiteMapper.ToDto(site)) : TypedResults.NotFound(SiteNotFound);

    private static async Task<Results<Ok<SiteDto>, NotFound<ApiError>, BadRequest<ApiError>>> UpdateSite(Guid id, SitePatchDto dto, SiteService service, CancellationToken ct)
    {
        if (await service.GetAsync(id, ct) is not { } site)
        {
            return TypedResults.NotFound(SiteNotFound);
        }

        SiteMapper.Apply(dto, site);
        var result = await service.UpdateAsync(site, ct);
        return result.IsSuccess ? TypedResults.Ok(SiteMapper.ToDto(result.Value)) : TypedResults.BadRequest(new ApiError(result.Error));
    }
}

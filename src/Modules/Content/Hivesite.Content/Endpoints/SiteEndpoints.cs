using Hivesite.Content.Application;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Hivesite.Content.Endpoints;

/// <summary>API-001. Each handler maps the DTO, calls <see cref="SiteService"/> and maps the result back. Nothing more.</summary>
internal static class SiteEndpoints
{
    private const string CursorPurpose = "Hivesite.Content.Sites";

    public static void MapSiteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var sites = endpoints.MapGroup("/sites").RequireOwner();
        sites.MapPost("", CreateSite).Validate<SitePostDto>();
        sites.MapGet("", ListSites).Validate<PageQuery>();
        sites.MapGet("{id}", GetSite);
        sites.MapPatch("{id}", UpdateSite).Validate<SitePatchDto>();
    }

    private static async Task<Created<SiteDto>> CreateSite(SitePostDto dto, SiteService service, CancellationToken ct)
    {
        var site = await service.CreateAsync(SiteMapper.ToEntity(dto), ct);
        return TypedResults.Created($"/sites/{site.Id}", SiteMapper.ToDto(site));
    }

    private static async Task<Ok<PageDto<SiteDto>>> ListSites([AsParameters] PageQuery query, SiteService service, CursorProtector cursors, CancellationToken ct)
    {
        var after = query.Cursor is null ? null : cursors.Unprotect<SiteCursor>(query.Cursor, CursorPurpose);
        var page = await service.ListAsync(query.Limit, after, ct);
        var next = page.HasMore ? cursors.Protect(new SiteCursor(page.Items[^1].CreatedAt, page.Items[^1].Id), CursorPurpose) : null;
        return TypedResults.Ok(new PageDto<SiteDto>(SiteMapper.ToDto(page.Items), next));
    }

    private static async Task<Ok<SiteDto>> GetSite(string id, SiteService service, CancellationToken ct) =>
        TypedResults.Ok(SiteMapper.ToDto(await service.GetAsync(ParseId(id), ct)));

    private static async Task<Ok<SiteDto>> UpdateSite(string id, SitePatchDto dto, SiteService service, CancellationToken ct)
    {
        var site = await service.GetAsync(ParseId(id), ct);
        SiteMapper.Apply(dto, site);
        return TypedResults.Ok(SiteMapper.ToDto(await service.UpdateAsync(site, ct)));
    }

    /// <summary>Only the canonical 8-4-4-4-12 form, any letter case. Anything else is an id no site has, so a 404.</summary>
    private static Guid ParseId(string id) => Guid.TryParseExact(id, "D", out var guid) ? guid : Guid.Empty;
}

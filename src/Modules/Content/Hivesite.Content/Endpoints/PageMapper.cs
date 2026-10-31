using Hivesite.Content.Domain;
using Hivesite.Shared;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Endpoints;

/// <summary>DTOs to and from <see cref="Page"/>. A null input member is skipped, so a PATCH changes only what was sent.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class PageMapper
{
    public static partial PageDto ToDto(Page page);

    public static partial IReadOnlyList<PageDto> ToDto(IReadOnlyList<Page> pages);

    [MapperIgnoreTarget(nameof(Page.Id))] // set by PageService
    [MapperIgnoreTarget(nameof(Page.MenuOrder))] // the end of the menu, set by PageService
    [MapperIgnoreTarget(nameof(Page.CreatedAt))] // set by PageService
    [MapperIgnoreTarget(nameof(Page.UpdatedAt))] // set by PageService
    public static partial Page ToEntity(PagePostDto dto, Guid siteId);

    [MapperIgnoreTarget(nameof(Page.Id))] // comes from the path, never from the body
    [MapperIgnoreTarget(nameof(Page.SiteId))] // a page never moves
    [MapperIgnoreTarget(nameof(Page.MenuOrder))] // only PUT /sites/{id}/menu changes it
    [MapperIgnoreTarget(nameof(Page.CreatedAt))] // never changes
    [MapperIgnoreTarget(nameof(Page.UpdatedAt))] // set by PageService, only when something changed
    public static partial void Apply(PagePatchDto dto, Page page);

    [MapperIgnoreTarget(nameof(PageFilter.Id))] // a list filters by site, not by one id
    [MapperIgnoreTarget(nameof(PageFilter.OwnerId))] // the site is checked against the owner first
    public static partial PageFilter ToFilter(PageQuery query, Guid siteId);

    public static PageDto<PageDto> ToDto(Page<Page> page) =>
        new(ToDto(page.Items), page.HasMore ? page.Items[^1].Id.ToString("D") : null);

    public static MenuDto ToMenuDto(Guid siteId, IReadOnlyList<Page> pages) => new(siteId, pages.Select(p => p.Id).ToList());
}

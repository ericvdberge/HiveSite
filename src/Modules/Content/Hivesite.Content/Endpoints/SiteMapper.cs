using Hivesite.Content.Domain;
using Hivesite.Shared;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Endpoints;

/// <summary>DTOs to and from <see cref="Site"/>. A null input member is skipped, so a PATCH changes only what was sent.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class SiteMapper
{
    [MapPropertyFromSource(nameof(SiteDto.Settings), Use = nameof(ToSettings))]
    public static partial SiteDto ToDto(Site site);

    public static partial IReadOnlyList<SiteDto> ToDto(IReadOnlyList<Site> sites);

    [MapperIgnoreTarget(nameof(Site.Id))] // set by SiteService
    [MapperIgnoreTarget(nameof(Site.OwnerId))] // the signed-in owner, set by SiteService
    [MapperIgnoreTarget(nameof(Site.CreatedAt))] // set by SiteService
    [MapperIgnoreTarget(nameof(Site.UpdatedAt))] // set by SiteService
    [MapProperty("Settings.Language", nameof(Site.Language))]
    [MapProperty("Settings.Description", nameof(Site.Description))]
    public static partial Site ToEntity(SitePostDto dto);

    [MapperIgnoreTarget(nameof(Site.Id))] // comes from the path, never from the body
    [MapperIgnoreTarget(nameof(Site.OwnerId))] // a site never changes owner
    [MapperIgnoreTarget(nameof(Site.CreatedAt))] // never changes
    [MapperIgnoreTarget(nameof(Site.UpdatedAt))] // set by SiteService, only when something changed
    [MapProperty("Settings.Language", nameof(Site.Language))]
    [MapProperty("Settings.Description", nameof(Site.Description))]
    public static partial void Apply(SitePatchDto dto, Site site);

    [MapperIgnoreTarget(nameof(SiteFilter.OwnerId))] // the signed-in owner, set by SiteService
    [MapperIgnoreTarget(nameof(SiteFilter.Id))] // a list filters by owner, not by one id
    public static partial SiteFilter ToFilter(PageQuery query);

    public static PageDto<SiteDto> ToDto(Page<Site> page) =>
        new(ToDto(page.Items), page.HasMore ? page.Items[^1].Id.ToString("D") : null);

    private static SiteSettingsDto ToSettings(Site site) => new(site.Language, site.Description);
}

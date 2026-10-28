using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Endpoints;

/// <summary>DTOs to and from <see cref="Site"/>. A null input member is skipped, so a PATCH changes only what was sent.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class SiteMapper
{
    [MapPropertyFromSource(nameof(SiteDto.Settings), Use = nameof(ToSettings))]
    public static partial SiteDto ToDto(Site site);

    public static partial IReadOnlyList<SiteDto> ToDto(IReadOnlyList<Site> sites);

    [MapperIgnoreTarget(nameof(Site.Id))]
    [MapperIgnoreTarget(nameof(Site.OwnerId))]
    [MapperIgnoreTarget(nameof(Site.CreatedAt))]
    [MapperIgnoreTarget(nameof(Site.UpdatedAt))]
    [MapProperty("Settings.Language", nameof(Site.Language))]
    [MapProperty("Settings.Description", nameof(Site.Description))]
    public static partial Site ToEntity(SitePostDto dto);

    [MapperIgnoreTarget(nameof(Site.Id))]
    [MapperIgnoreTarget(nameof(Site.OwnerId))]
    [MapperIgnoreTarget(nameof(Site.CreatedAt))]
    [MapperIgnoreTarget(nameof(Site.UpdatedAt))]
    [MapProperty("Settings.Language", nameof(Site.Language))]
    [MapProperty("Settings.Description", nameof(Site.Description))]
    public static partial void Apply(SitePatchDto dto, Site site);

    private static SiteSettingsDto ToSettings(Site site) => new(site.Language, site.Description);
}

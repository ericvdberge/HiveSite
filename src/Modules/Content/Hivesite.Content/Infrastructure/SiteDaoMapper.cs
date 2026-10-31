using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Infrastructure;

/// <summary>Rows to and from <see cref="Site"/>.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Both)]
internal static partial class SiteDaoMapper
{
    public static partial Site ToDomain(SiteDao dao);

    public static partial IReadOnlyList<Site> ToDomain(IReadOnlyList<SiteDao> daos);

    public static partial SiteDao ToDao(Site site);

    /// <summary>Copies the site onto its tracked row, so EF Core writes only the columns that changed.</summary>
    public static partial void Apply(Site site, SiteDao dao);
}

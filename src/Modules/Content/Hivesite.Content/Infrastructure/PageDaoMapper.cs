using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Infrastructure;

/// <summary>Rows to and from <see cref="Page"/>.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Both)]
internal static partial class PageDaoMapper
{
    public static partial Page ToDomain(PageDao dao);

    public static partial IReadOnlyList<Page> ToDomain(IReadOnlyList<PageDao> daos);

    public static partial PageDao ToDao(Page page);

    /// <summary>Copies the page onto its tracked row, so EF Core writes only the columns that changed.</summary>
    public static partial void Apply(Page page, PageDao dao);
}

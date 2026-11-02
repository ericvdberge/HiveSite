using System.Text.Json;
using System.Text.Json.Nodes;
using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Application;

/// <summary>Internal records to the contract DTOs of <see cref="IContentApi"/>.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class ContentApiMapper
{
    public static partial IReadOnlyList<BlockTypeInfo> ToInfo(IReadOnlyList<BlockType> blockTypes);

    [MapValue(nameof(Contracts.SiteSnapshot.SnapshotFormat), Contracts.SiteSnapshot.Format)]
    public static partial Contracts.SiteSnapshot ToContract(Domain.SiteSnapshot snapshot);

    [MapPropertyFromSource(nameof(SnapshotSite.Settings), Use = nameof(ToSettings))]
    private static partial SnapshotSite ToContract(Site site);

    private static partial SnapshotSiteSettings ToSettings(Site site);

    [MapNestedProperties(nameof(Domain.SnapshotPage.Page))]
    [MapProperty(nameof(Domain.SnapshotPage.Blocks) + "." + nameof(PageBlocks.Document), nameof(Contracts.SnapshotPage.Blocks))]
    private static partial Contracts.SnapshotPage ToContract(Domain.SnapshotPage page);

    private static JsonElement ToElement(JsonObject document) => JsonSerializer.SerializeToElement(document);
}

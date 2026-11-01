using System.Text.Json.Nodes;
using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Infrastructure;

/// <summary>Rows to and from <see cref="PageBlocks"/>. The document is stored as JSON text.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Both)]
internal static partial class PageBlocksDaoMapper
{
    public static partial PageBlocks ToDomain(PageBlocksDao dao);

    public static partial PageBlocksDao ToDao(PageBlocks blocks);

    private static JsonObject ParseDocument(string json) => JsonNode.Parse(json)!.AsObject();

    private static string WriteDocument(JsonObject document) => document.ToJsonString();
}

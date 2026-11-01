using System.Text.Json.Nodes;

namespace Hivesite.Content.Domain;

/// <summary>
/// The blocks of a page as one Tiptap document (API-004) and its version. A page without a stored row has the empty
/// document at version 1, see <see cref="Empty"/>. The document is open JSON, so compare with <c>JsonNode.DeepEquals</c>, not <c>==</c>.
/// </summary>
public sealed record PageBlocks
{
    public Guid PageId { get; set; }

    public JsonObject Document { get; set; } = new() { ["type"] = "doc", ["content"] = new JsonArray() };

    public int Version { get; set; } = 1;

    public static PageBlocks Empty(Guid pageId) => new() { PageId = pageId };
}

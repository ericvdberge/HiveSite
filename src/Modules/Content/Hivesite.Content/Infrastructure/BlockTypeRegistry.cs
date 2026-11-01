using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Hivesite.Content.Domain;

namespace Hivesite.Content.Infrastructure;

/// <summary>
/// The seven block types of API-003, fixed in code and in the embedded <c>BlockTypes/*.json</c> files. No database.
/// Each served schema is <c>$schema</c>, the type's own schema, then the shared <c>$defs</c>.
/// </summary>
internal sealed class BlockTypeRegistry
{
    private const string SchemaUri = "https://json-schema.org/draft/2020-12/schema";

    private static readonly (string Type, string Name, string Description)[] Definitions =
    [
        ("hero", "Hero", "A large opening section with a title, an optional image and one call to action."),
        ("rich_text", "Rich text", "Headings, paragraphs and lists, with bold, italic and links."),
        ("image", "Image", "One image with alt text and an optional caption."),
        ("gallery", "Gallery", "A grid of 1 to 24 images."),
        ("card_list", "Card list", "Cards in a grid or a list, written by hand or drawn from a collection such as the site's pages, paged."),
        ("contact_form", "Contact form", "A form of 1 to 10 fields that posts to an external address."),
        ("embed", "Embed", "A video or map from an allowed provider."),
    ];

    public BlockTypeRegistry() =>
        All = Definitions.Select(d => new BlockType(d.Type, d.Name, d.Description, 1, BuildSchema(d.Type))).ToList();

    /// <summary>All block types in the fixed order of API-003.</summary>
    public IReadOnlyList<BlockType> All { get; }

    private static JsonElement BuildSchema(string type)
    {
        var schema = new JsonObject { ["$schema"] = SchemaUri };
        foreach (var (key, value) in Read(type).AsObject())
        {
            schema[key] = value?.DeepClone();
        }
        schema["$defs"] = Read("defs").DeepClone();
        return JsonSerializer.SerializeToElement(schema);
    }

    private static JsonNode Read(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"Hivesite.Content.BlockTypes.{name}.json")!;
        return JsonNode.Parse(stream)!;
    }
}

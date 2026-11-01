using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Hivesite.Content.Tests;

/// <summary>
/// What specs/content/API-003-block-types.md says, read from the file itself, so the served schemas cannot drift from the spec.
/// </summary>
internal static partial class BlockTypeSpec
{
    public const string SchemaUri = "https://json-schema.org/draft/2020-12/schema";

    /// <summary>The seven types with the <c>name</c> and <c>description</c> of the table in Block types, in order.</summary>
    public static readonly (string Type, string Name, string Description)[] Table =
    [
        ("hero", "Hero", "A large opening section with a title, an optional image and one call to action."),
        ("rich_text", "Rich text", "Headings, paragraphs and lists, with bold, italic and links."),
        ("image", "Image", "One image with alt text and an optional caption."),
        ("gallery", "Gallery", "A grid of 1 to 24 images."),
        ("card_list", "Card list", "Cards in a grid or a list, written by hand or drawn from a collection such as the site's pages, paged."),
        ("contact_form", "Contact form", "A form of 1 to 10 fields that posts to an external address."),
        ("embed", "Embed", "A video or map from an allowed provider."),
    ];

    private static readonly Lazy<string> Markdown = new(() => File.ReadAllText(Path.Combine(Root(), "specs", "content", "API-003-block-types.md")));

    /// <summary>The object of Shared definitions.</summary>
    public static JsonNode Defs() => JsonNode.Parse(Block(DefsHeading().Match(Markdown.Value).Groups[1].Value))!;

    /// <summary>The schema of a type as the spec gives it: without <c>$schema</c> and <c>$defs</c>.</summary>
    public static JsonObject Own(string type)
    {
        if (type == "hero")
        {
            var response = JsonNode.Parse(Block(Markdown.Value[Markdown.Value.IndexOf("Response 200", StringComparison.Ordinal)..]))!;
            var hero = response["items"]![0]!["schema"]!.AsObject();
            hero.Remove("$schema");
            hero.Remove("$defs");
            return hero;
        }
        var heading = $"### {type}\n";
        return JsonNode.Parse(Block(Markdown.Value[Markdown.Value.IndexOf(heading, StringComparison.Ordinal)..]))!.AsObject();
    }

    /// <summary>The full schema a type must be served with.</summary>
    public static JsonObject Full(string type)
    {
        var schema = new JsonObject { ["$schema"] = SchemaUri };
        foreach (var (key, value) in Own(type))
        {
            schema[key] = value?.DeepClone();
        }
        schema["$defs"] = Defs();
        return schema;
    }

    /// <summary>The first fenced json block of <paramref name="from"/>.</summary>
    private static string Block(string from)
    {
        var start = from.IndexOf("```json\n", StringComparison.Ordinal) + "```json\n".Length;
        return from[start..from.IndexOf("\n```", start, StringComparison.Ordinal)];
    }

    private static string Root()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "specs", "content", "API-003-block-types.md")))
        {
            dir = dir.Parent;
        }
        return dir!.FullName;
    }

    [GeneratedRegex(@"## Shared definitions([\s\S]*)")]
    private static partial Regex DefsHeading();
}

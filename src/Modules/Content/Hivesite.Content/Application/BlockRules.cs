using System.Text.Json.Nodes;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>
/// The checks of API-003 "Rules beyond the schemas" for one block, after its schema check passed. They read the block and never change it.
/// Each rule is one method, run in the order of the spec; the first failure is returned. The pointer is always the value that breaks the rule.
/// </summary>
internal static class BlockRules
{
    private const int MaxCodePoints = 10_000;
    private const int MaxListDepth = 3;

    public static Error? Check(JsonObject block, string pointer)
    {
        var type = block["type"]?.GetValue<string>();
        return HostlessUrl(block, pointer)
            ?? (type == "contact_form" ? UniqueFieldNames(block, pointer) : null)
            ?? (type == "embed" ? EmbedProvider(block, pointer) : null)
            ?? (type == "rich_text" ? RichText(block, pointer) : null);
    }

    private static Error? RichText(JsonObject block, string pointer) =>
        TooMuchText(block, pointer)
        ?? ListTooDeep(block, pointer, 0)
        ?? ListItemStartsWithList(block, pointer)
        ?? MarkTwice(block, pointer);

    /// <summary>An <c>https://</c> value in a <c>url</c>, <c>href</c> or <c>action_url</c> needs a host. Mail links and site paths are not checked.</summary>
    private static Error? HostlessUrl(JsonNode node, string pointer)
    {
        foreach (var (child, path, key) in Children(node, pointer))
        {
            if (key is "url" or "href" or "action_url" && child is JsonValue value && value.TryGetValue(out string? text)
                && text.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && Host(text) is null)
            {
                return Fail(path, "must have a host");
            }
            if (HostlessUrl(child, path) is { } error)
            {
                return error;
            }
        }
        return null;
    }

    private static Error? UniqueFieldNames(JsonObject block, string pointer)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var fields = block["attrs"]?["fields"]?.AsArray() ?? [];
        for (var i = 0; i < fields.Count; i++)
        {
            if (fields[i]?["name"]?.GetValue<string>() is { } name && !seen.Add(name))
            {
                return Fail($"{pointer}/attrs/fields/{i}/name", "must be unique within the form");
            }
        }
        return null;
    }

    private static Error? EmbedProvider(JsonObject block, string pointer)
    {
        var attrs = block["attrs"]!;
        if (attrs["url"]?.GetValue<string>() is not { } text || !Uri.TryCreate(text, UriKind.Absolute, out var uri))
        {
            return null;   // not a url at all: the schema or the host rule has already refused it
        }

        var provider = attrs["provider"]?.GetValue<string>();
        var ok = provider switch
        {
            "youtube" => uri.Host is "www.youtube.com" or "youtube.com" or "youtu.be",
            "vimeo" => uri.Host is "vimeo.com" or "player.vimeo.com",
            "google_maps" => uri.Host == "www.google.com" && uri.AbsolutePath.StartsWith("/maps/embed", StringComparison.Ordinal),
            _ => true,
        };
        return ok ? null : Fail($"{pointer}/attrs/url", provider switch
        {
            "youtube" => "must be a YouTube address",
            "vimeo" => "must be a Vimeo address",
            _ => "must be a Google Maps embed address",
        });
    }

    private static Error? TooMuchText(JsonObject block, string pointer)
    {
        var total = 0;
        foreach (var (node, _) in Descendants(block, pointer))
        {
            if (node["type"]?.GetValue<string>() == "text" && node["text"] is JsonValue text && text.TryGetValue(out string? run))
            {
                total += run.EnumerateRunes().Count();
            }
        }
        return total > MaxCodePoints ? Fail($"{pointer}/content", $"must have at most {MaxCodePoints} characters of text in total") : null;
    }

    private static Error? ListTooDeep(JsonNode node, string pointer, int depth)
    {
        foreach (var (child, path) in Content(node, pointer))
        {
            var level = child["type"]?.GetValue<string>() is "bulletList" or "orderedList" ? depth + 1 : depth;
            if (level > MaxListDepth)
            {
                return Fail(path, $"lists can nest at most {MaxListDepth} levels");
            }
            if (ListTooDeep(child, path, level) is { } error)
            {
                return error;
            }
        }
        return null;
    }

    private static Error? ListItemStartsWithList(JsonObject block, string pointer)
    {
        foreach (var (node, path) in Descendants(block, pointer))
        {
            if (node["type"]?.GetValue<string>() == "listItem" && node["content"] is JsonArray { Count: > 0 } items
                && items[0]?["type"]?.GetValue<string>() is "bulletList" or "orderedList")
            {
                return Fail($"{path}/content/0", "the first child of a list item must be a paragraph");
            }
        }
        return null;
    }

    private static Error? MarkTwice(JsonObject block, string pointer)
    {
        foreach (var (node, path) in Descendants(block, pointer))
        {
            if (node["type"]?.GetValue<string>() != "text" || node["marks"] is not JsonArray marks)
            {
                continue;
            }
            var seen = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < marks.Count; i++)
            {
                if (marks[i]?["type"]?.GetValue<string>() is { } type && !seen.Add(type))
                {
                    return Fail($"{path}/marks/{i}", $"has the mark '{type}' more than once");
                }
            }
        }
        return null;
    }

    /// <summary>The host of an absolute <c>https://</c> value, or null when there is none.</summary>
    private static string? Host(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.Host.Length > 0 ? uri.Host : null;

    private static Error Fail(string field, string problem) => new("invalid_block", $"{field}: {problem}", field);

    private static string Escape(string segment) => segment.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);

    /// <summary>The direct children of an object or array, in document order, with their pointers and property names.</summary>
    private static IEnumerable<(JsonNode Node, string Pointer, string? Key)> Children(JsonNode node, string pointer)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var (name, value) in obj)
                {
                    if (value is not null)
                    {
                        yield return (value, $"{pointer}/{Escape(name)}", name);
                    }
                }
                break;
            case JsonArray array:
                for (var i = 0; i < array.Count; i++)
                {
                    if (array[i] is { } value)
                    {
                        yield return (value, $"{pointer}/{i}", null);
                    }
                }
                break;
        }
    }

    /// <summary>The nodes in the <c>content</c> array of <paramref name="node"/>.</summary>
    private static IEnumerable<(JsonNode Node, string Pointer)> Content(JsonNode node, string pointer) =>
        node is JsonObject { } obj && obj["content"] is JsonArray content
            ? Children(content, $"{pointer}/content").Select(c => (c.Node, c.Pointer))
            : [];

    /// <summary>Every node of the rich-text tree below <paramref name="node"/> (not the node itself), depth first, in document order.</summary>
    private static IEnumerable<(JsonNode Node, string Pointer)> Descendants(JsonNode node, string pointer)
    {
        foreach (var (child, path) in Content(node, pointer))
        {
            yield return (child, path);
            foreach (var inner in Descendants(child, path))
            {
                yield return inner;
            }
        }
    }
}

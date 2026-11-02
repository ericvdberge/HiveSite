using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;
using Json.Schema;

namespace Hivesite.Content.Application;

/// <summary>
/// Checks a blocks document (API-004 Validation) against the schemas of <see cref="BlockTypeRegistry"/>, the only source of schemas,
/// and returns the document to store: plain strings trimmed (not the <c>text</c> of <c>text</c> nodes) and every <c>default</c> filled
/// in at every depth. No database. The first failure is returned, in the order of the spec.
/// </summary>
internal sealed partial class BlockDocumentValidator
{
    public const int MaxBlocks = 40;

    private static readonly HashSet<string> Applicators = ["properties", "items", "allOf", "anyOf", "$ref"];

    private static readonly EvaluationOptions Options = new() { OutputFormat = OutputFormat.List };

    private readonly Dictionary<string, BlockSchema> _blocks;

    static BlockDocumentValidator()
    {
        // Our wording, as in the spec's example "must be at most 80 characters". The text is the same for every caller of the library.
        ErrorMessages.MaxLength = "must be at most [[limit]] characters";
        ErrorMessages.MinLength = "must be at least [[limit]] characters";
        ErrorMessages.MaxItems = "must have at most [[limit]] items";
        ErrorMessages.MinItems = "must have at least [[limit]] items";
        ErrorMessages.Maximum = "must be at most [[limit]]";
        ErrorMessages.Minimum = "must be at least [[limit]]";
        ErrorMessages.Pattern = "is not in the allowed format";
        ErrorMessages.Const = "must be [[value]]";
        ErrorMessages.Enum = "must be one of [[values]]";
        ErrorMessages.AdditionalProperties = "[[failed]]";
        ErrorMessages.OneOf = "does not match any allowed shape";
    }

    public BlockDocumentValidator(BlockTypeRegistry registry) =>
        _blocks = registry.All.ToDictionary(t => t.Type, t => new BlockSchema(JsonNode.Parse(t.Schema.GetRawText())!.AsObject()));

    /// <summary>The document to store, or the first failure. <paramref name="document"/> is not changed.</summary>
    public Result<JsonObject> Validate(JsonNode? document)
    {
        if (CheckShape(document) is { } invalid)
        {
            return invalid;
        }

        var content = document!.AsObject()["content"]!.AsArray();
        if (content.Count > MaxBlocks)
        {
            return new Error("too_many_blocks", $"A page can have at most {MaxBlocks} blocks.", "/content");
        }

        var result = new JsonArray();
        for (var i = 0; i < content.Count; i++)
        {
            var block = content[i]!.AsObject();
            var pointer = $"/content/{i}";
            if (!_blocks.TryGetValue(block["type"]!.GetValue<string>(), out var schema))
            {
                return new Error("unknown_block_type", $"{pointer}/type: is not a block type.", $"{pointer}/type");
            }

            var (normalized, error) = Apply(block.DeepClone(), schema.Root, schema, pointer);
            error ??= FirstError(schema.Whole, normalized, pointer);
            error ??= BlockRules.Check(normalized!.AsObject(), pointer);
            if (error is not null)
            {
                return error;
            }
            result.Add(normalized);
        }
        return new JsonObject { ["type"] = "doc", ["content"] = result };
    }

    private static Error? CheckShape(JsonNode? document)
    {
        if (document is not JsonObject root)
        {
            return Invalid("The body must be a JSON object.", null);
        }
        if (root.FirstOrDefault(p => p.Key is not ("type" or "content")) is { Key: { } extra })
        {
            return Invalid($"Unknown field '{extra}'.", "/" + Escape(extra));
        }
        if (root["type"] is not JsonValue type || !type.TryGetValue(out string? name) || name != "doc")
        {
            return Invalid("'type' must be \"doc\".", "/type");
        }
        if (root["content"] is not JsonArray content)
        {
            return Invalid("'content' must be an array of blocks.", "/content");
        }

        for (var i = 0; i < content.Count; i++)
        {
            if (content[i] is not JsonObject block)
            {
                return Invalid("A block must be an object.", $"/content/{i}");
            }
            if (block["type"] is not JsonValue blockType || !blockType.TryGetValue(out string? _))
            {
                return Invalid("A block needs a 'type'.", $"/content/{i}/type");
            }
        }
        return null;
    }

    private static Error Invalid(string message, string? field) => new("invalid_request", message, field);

    /// <summary>Trims strings, fills defaults and, where the schema offers a choice, validates the chosen branch so its error names the real problem.</summary>
    private static (JsonNode? Node, Error? Error) Apply(JsonNode? node, JsonObject schema, BlockSchema block, string pointer)
    {
        schema = block.Resolve(schema);

        if (schema["oneOf"] is JsonArray branches)
        {
            if (Pick(node, branches, block) is not { } branch)
            {
                return (node, null);   // no single branch fits: the whole-block check reports the oneOf itself
            }
            var (chosen, error) = Apply(node, branch, block, pointer);
            return (chosen, error ?? FirstError(block.Branch(branch), chosen, pointer));
        }

        switch (node)
        {
            case JsonValue value when value.TryGetValue(out string? text):
                text = text.Trim();
                return (JsonValue.Create(text), CheckLength(text, schema, pointer));
            case JsonObject obj when schema["properties"] is JsonObject properties:
                var rawText = obj["type"] is JsonValue t && t.TryGetValue(out string? kind) && kind == "text";
                foreach (var (name, propertySchema) in properties)
                {
                    if (obj.TryGetPropertyValue(name, out var current))
                    {
                        if (rawText && name == "text")
                        {
                            // Spaces between marked runs matter, so no trim; the length is still checked.
                            if (current is JsonValue raw && raw.TryGetValue(out string? run) && CheckLength(run, block.Resolve(propertySchema!.AsObject()), $"{pointer}/text") is { } tooLong)
                            {
                                return (node, tooLong);
                            }
                            continue;
                        }
                        var (applied, error) = Apply(current, propertySchema!.AsObject(), block, $"{pointer}/{Escape(name)}");
                        if (error is not null)
                        {
                            return (node, error);
                        }
                        if (!ReferenceEquals(applied, current))
                        {
                            obj[name] = applied;   // a node can only be assigned once
                        }
                    }
                    else if (propertySchema!.AsObject().TryGetPropertyValue("default", out var fallback))
                    {
                        obj[name] = fallback?.DeepClone();
                    }
                }
                return (obj, null);
            case JsonArray array when schema["items"] is JsonObject items:
                for (var i = 0; i < array.Count; i++)
                {
                    var (applied, error) = Apply(array[i], items, block, $"{pointer}/{i}");
                    if (error is not null)
                    {
                        return (node, error);
                    }
                    if (!ReferenceEquals(applied, array[i]))
                    {
                        array[i] = applied;
                    }
                }
                return (array, null);
            default:
                return (node, null);
        }
    }

    /// <summary>
    /// <c>minLength</c> and <c>maxLength</c> count Unicode code points (API-001, API-003). JsonSchema.Net counts grapheme clusters, which is
    /// more lenient, so the check is made here and the library's own length errors are ignored in <see cref="FirstError"/>.
    /// </summary>
    private static Error? CheckLength(string text, JsonObject schema, string pointer)
    {
        var length = text.EnumerateRunes().Count();
        if (schema["maxLength"] is JsonValue max && length > max.GetValue<int>())
        {
            return new Error("invalid_block", $"{pointer}: must be at most {max} characters", pointer);
        }
        if (schema["minLength"] is JsonValue min && length < min.GetValue<int>())
        {
            return new Error("invalid_block", $"{pointer}: must be at least {min} characters", pointer);
        }
        return null;
    }

    /// <summary>The one branch the value can be, told apart by JSON kind and by a <c>const</c> property (<c>type</c>, <c>kind</c>); otherwise null.</summary>
    private static JsonObject? Pick(JsonNode? node, JsonArray branches, BlockSchema block)
    {
        var fits = branches.Select(b => block.Resolve(b!.AsObject())).Where(b => Fits(node, b)).Take(2).ToList();
        return fits.Count == 1 ? fits[0] : null;
    }

    private static bool Fits(JsonNode? node, JsonObject branch)
    {
        if (branch["type"] is { } allowed)
        {
            var kinds = allowed is JsonArray list ? list.Select(k => k!.GetValue<string>()).ToList() : [allowed.GetValue<string>()];
            var actual = node switch
            {
                null => "null",
                JsonObject => "object",
                JsonArray => "array",
                _ => node.GetValueKind() switch
                {
                    JsonValueKind.String => "string",
                    JsonValueKind.True or JsonValueKind.False => "boolean",
                    _ => "number",
                },
            };
            if (!kinds.Contains(actual) && !(actual == "number" && kinds.Contains("integer")))
            {
                return false;
            }
        }
        return branch["properties"] is not JsonObject properties
            || properties.Where(p => p.Value is JsonObject s && s.ContainsKey("const"))
                .All(p => node is JsonObject obj && JsonNode.DeepEquals(obj[p.Key], p.Value!["const"]));
    }

    /// <summary>
    /// The first problem of <paramref name="node"/> against <paramref name="schema"/>, with <paramref name="pointer"/> in front of the
    /// library's location. Problems inside a <c>oneOf</c> branch are noise when no branch fits, so the <c>oneOf</c> itself is reported.
    /// </summary>
    private static Error? FirstError(JsonSchema schema, JsonNode? node, string pointer)
    {
        var results = schema.Evaluate(JsonSerializer.SerializeToElement(node), Options);
        if (results.IsValid)
        {
            return null;
        }

        // Parents only say that something below them failed ("properties", "items"); the failure itself is the entry with a message of its own.
        var failures = new[] { results }.Concat(results.Details ?? [])
            .Where(r => !r.IsValid)
            .SelectMany(r => (r.Errors ?? []).Where(e => !Applicators.Contains(e.Key) && e.Key is not ("minLength" or "maxLength")).Select(e => (Result: r, e.Key, e.Value)))
            .ToList();
        var failure = failures.FirstOrDefault(f => !InsideBranch().IsMatch(f.Result.EvaluationPath.ToString()));
        if (failure.Result is null)
        {
            failure = failures.FirstOrDefault();
        }
        if (failure.Result is null)
        {
            return new Error("invalid_block", $"{pointer}: is not valid.", pointer);
        }

        var field = pointer + failure.Result.InstanceLocation;
        var message = failure.Value;
        if (failure.Key == "additionalProperties" && JsonNode.Parse(message) is JsonArray { Count: > 0 } names)
        {
            field += "/" + Escape(names[0]!.GetValue<string>());   // the message of the library names the unknown properties
            message = "is not allowed";
        }
        return new Error("invalid_block", $"{field}: {message}", field);
    }

    internal static string Escape(string segment) => segment.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);

    [GeneratedRegex(@"/oneOf/\d+")]
    private static partial Regex InsideBranch();

    /// <summary>One block type's schema, parsed once, with the compiled whole and the compiled branches it needs.</summary>
    private sealed class BlockSchema
    {
        private readonly ConcurrentDictionary<JsonObject, JsonSchema> _branches = new(ReferenceEqualityComparer.Instance);

        public BlockSchema(JsonObject root)
        {
            Root = root;
            Whole = JsonSchema.FromText(root.ToJsonString());
        }

        public JsonObject Root { get; }

        public JsonSchema Whole { get; }

        /// <summary>Follows a local <c>$ref</c> into <c>$defs</c>.</summary>
        public JsonObject Resolve(JsonObject schema) =>
            schema["$ref"] is JsonValue reference && reference.GetValue<string>() is var path && path.StartsWith("#/$defs/", StringComparison.Ordinal)
                ? Resolve(Root["$defs"]![path["#/$defs/".Length..]]!.AsObject())
                : schema;

        public JsonSchema Branch(JsonObject branch) => _branches.GetOrAdd(branch, b =>
        {
            var standalone = (JsonObject)b.DeepClone();
            standalone["$schema"] = Root["$schema"]!.DeepClone();
            standalone["$defs"] = Root["$defs"]!.DeepClone();
            return JsonSchema.FromText(standalone.ToJsonString());
        });
    }
}

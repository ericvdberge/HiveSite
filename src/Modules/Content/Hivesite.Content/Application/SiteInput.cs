using System.Text.Json;
using System.Text.RegularExpressions;
using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Application;

/// <summary>A validated body. A null member was not sent.</summary>
public sealed record SiteInput(string? Name, string? Slug, string? Language, string? Description);

public sealed record InputError(string Message, string? Field);

/// <summary>Strict parsing of the POST and PATCH bodies: unknown fields, wrong types and null are all errors.</summary>
public static partial class SiteInputParser
{
    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")]
    private static partial Regex SlugPattern();

    [GeneratedRegex("^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$")]
    private static partial Regex LanguagePattern();

    public static (SiteInput? Input, InputError? Error) Parse(JsonElement root, bool isCreate)
    {
        string? name = null, slug = null, language = null, description = null;

        foreach (var property in root.EnumerateObject())
        {
            InputError? error;
            switch (property.Name)
            {
                case "name":
                    error = Text(property.Value, ["name"], 1, 80, null, out name);
                    break;
                case "slug":
                    error = Text(property.Value, ["slug"], 3, 40, SlugPattern(), out slug);
                    break;
                case "settings":
                    error = Settings(property.Value, out language, out description);
                    break;
                default:
                    error = new InputError($"Unknown field '{property.Name}'.", Http.Pointer(property.Name));
                    break;
            }
            if (error is not null)
            {
                return (null, error);
            }
        }

        if (isCreate && name is null)
        {
            return (null, new InputError("'name' is required.", "/name"));
        }
        if (isCreate && slug is null)
        {
            return (null, new InputError("'slug' is required.", "/slug"));
        }
        return (new SiteInput(name, slug, language, description), null);
    }

    private static InputError? Settings(JsonElement value, out string? language, out string? description)
    {
        language = null;
        description = null;
        if (value.ValueKind != JsonValueKind.Object)
        {
            return new InputError("'settings' must be an object.", "/settings");
        }
        foreach (var property in value.EnumerateObject())
        {
            var error = property.Name switch
            {
                "language" => Text(property.Value, ["settings", "language"], 2, 35, LanguagePattern(), out language),
                "description" => Text(property.Value, ["settings", "description"], 0, 160, null, out description),
                _ => new InputError($"Unknown field 'settings.{property.Name}'.", Http.Pointer("settings", property.Name)),
            };
            if (error is not null)
            {
                return error;
            }
        }
        return null;
    }

    private static InputError? Text(JsonElement value, string[] path, int min, int max, Regex? pattern, out string? result)
    {
        result = null;
        var field = Http.Pointer(path);
        var label = string.Join('.', path);
        if (value.ValueKind != JsonValueKind.String)
        {
            return new InputError($"'{label}' must be a string and not null.", field);
        }
        var trimmed = value.GetString()!.Trim();
        var length = Http.CodePoints(trimmed);
        if (length < min || length > max)
        {
            return new InputError($"'{label}' must be {min} to {max} characters.", field);
        }
        if (pattern is not null && !pattern.IsMatch(trimmed))
        {
            return new InputError($"'{label}' has an invalid format.", field);
        }
        result = trimmed;
        return null;
    }
}

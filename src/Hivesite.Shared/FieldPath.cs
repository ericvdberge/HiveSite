using System.Text.Json;
using System.Text.RegularExpressions;

namespace Hivesite.Shared;

/// <summary>Builds the <c>field</c> of an error: a JSON Pointer into the body (RFC 6901), as in specs/STYLE.md.</summary>
public static partial class FieldPath
{
    [GeneratedRegex(@"\[(\d+)\]")]
    private static partial Regex Index();

    /// <summary><c>$.settings.language</c> → <c>/settings/language</c>. The root itself is no field.</summary>
    public static string? FromJsonPath(string? path) =>
        path is null or "$" ? null : "/" + Index().Replace(path[2..], ".$1").Replace('.', '/');

    /// <summary>A FluentValidation property name, <c>Settings.Language</c> → <c>/settings/language</c>.</summary>
    public static string FromProperty(string propertyName) =>
        "/" + string.Join('/', propertyName.Split('.').Select(JsonNamingPolicy.SnakeCaseLower.ConvertName));
}

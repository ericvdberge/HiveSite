using System.Text.Json.Serialization;

namespace Hivesite.Shared;

/// <summary>The error body every endpoint returns, as in specs/STYLE.md.</summary>
public sealed record ApiError(ApiErrorDetail Error)
{
    public static ApiError Of(string code, string message, string? field = null) =>
        new(new ApiErrorDetail(code, message, field));
}

/// <summary><c>code</c> is snake_case; <c>field</c> names the failing input and is left out when none is to blame.</summary>
public sealed record ApiErrorDetail(
    string Code,
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Field = null);

using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Serialization;

namespace Hivesite.Shared;

/// <summary>Why something failed. <c>Code</c> is snake_case; <c>Field</c> names the failing input and is left out when none is to blame.</summary>
public sealed record Error(
    string Code,
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Field = null);

/// <summary>The error body every endpoint returns, as in specs/STYLE.md.</summary>
public sealed record ApiError(Error Error)
{
    public static ApiError Of(string code, string message, string? field = null) => new(new Error(code, message, field));
}

/// <summary>A value, or the business rule it broke. Services return it instead of throwing.</summary>
public sealed class Result<T>
{
    private readonly T? _value;

    private Result(T? value, Error? error)
    {
        _value = value;
        Error = error;
    }

    public Error? Error { get; }

    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => Error is null;

    public T Value => IsSuccess ? _value! : throw new InvalidOperationException($"The result failed: {Error.Code}.");

    public static implicit operator Result<T>(T value) => new(value, null);

    public static implicit operator Result<T>(Error error) => new(default, error);
}

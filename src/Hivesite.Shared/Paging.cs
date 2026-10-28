using System.Security.Cryptography;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.DataProtection;

namespace Hivesite.Shared;

/// <summary><c>?limit=&amp;cursor=</c> of every list (specs/STYLE.md). Bind with <c>[AsParameters]</c>.</summary>
public sealed record PageQuery(int Limit = 20, string? Cursor = null);

public sealed class PageQueryValidator : AbstractValidator<PageQuery>
{
    public PageQueryValidator() =>
        RuleFor(q => q.Limit).InclusiveBetween(1, 100).WithMessage("'limit' must be an integer from 1 to 100.");
}

/// <summary>One page from a service: <c>HasMore</c> tells the endpoint to hand out a next cursor.</summary>
public sealed record Page<T>(IReadOnlyList<T> Items, bool HasMore);

/// <summary>The list body of every API: <c>{ items, next_cursor }</c>.</summary>
public sealed record PageDto<T>(IReadOnlyList<T> Items, string? NextCursor);

/// <summary>
/// Signs and encrypts cursors so a client cannot forge or edit one. The purpose names the list,
/// so a cursor from one endpoint is refused by another. Keys come from ASP.NET Core Data Protection.
/// </summary>
public sealed class CursorProtector(IDataProtectionProvider provider)
{
    private const string Prefix = "c_";

    public string Protect<T>(T value, string purpose) =>
        Prefix + provider.CreateProtector(purpose).Protect(JsonSerializer.Serialize(value));

    /// <summary>Throws 400 <c>invalid_cursor</c> for anything this list did not issue.</summary>
    public T Unprotect<T>(string cursor, string purpose)
    {
        try
        {
            if (cursor.StartsWith(Prefix, StringComparison.Ordinal)
                && JsonSerializer.Deserialize<T>(provider.CreateProtector(purpose).Unprotect(cursor[Prefix.Length..])) is { } value)
            {
                return value;
            }
        }
        catch (Exception e) when (e is CryptographicException or JsonException)
        {
        }
        throw new BusinessRuleException("invalid_cursor", "The cursor is not valid.", "cursor");
    }
}

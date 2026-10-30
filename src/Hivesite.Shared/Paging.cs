using FluentValidation;

namespace Hivesite.Shared;

/// <summary>
/// <c>?limit=&amp;cursor=</c> of every list (specs/STYLE.md). Bind with <c>[AsParameters]</c>.
/// The cursor is the id of the last item of the previous page.
/// </summary>
public sealed record PageQuery(int Limit = 20, string? Cursor = null)
{
    /// <summary>The cursor as an id. Text that is no id points at no item, so the list refuses it like an unknown id.</summary>
    public Guid? After => Cursor is null ? null : Guid.TryParse(Cursor, out var id) ? id : Guid.Empty;
}

public sealed class PageQueryValidator : AbstractValidator<PageQuery>
{
    public PageQueryValidator() =>
        RuleFor(q => q.Limit).InclusiveBetween(1, 100).WithMessage("'limit' must be an integer from 1 to 100.");
}

/// <summary>One page from a repository: <c>HasMore</c> tells the endpoint to hand out a next cursor.</summary>
public sealed record Page<T>(IReadOnlyList<T> Items, bool HasMore);

/// <summary>The list body of every API: <c>{ items, next_cursor }</c>.</summary>
public sealed record PageDto<T>(IReadOnlyList<T> Items, string? NextCursor);

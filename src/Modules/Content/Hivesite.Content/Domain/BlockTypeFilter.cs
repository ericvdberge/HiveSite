namespace Hivesite.Content.Domain;

/// <summary>Which block types to read. A new way to filter is a new property here, not a new method.</summary>
public sealed record BlockTypeFilter
{
    /// <summary>Only the block types after the one with this <c>type</c>, in registry order.</summary>
    public string? Cursor { get; init; }

    public int Limit { get; init; } = 20;
}

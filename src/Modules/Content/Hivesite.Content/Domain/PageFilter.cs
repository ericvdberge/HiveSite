namespace Hivesite.Content.Domain;

/// <summary>Which pages to read. A new way to filter is a new property here, not a new method.</summary>
public sealed record PageFilter
{
    public Guid? SiteId { get; init; }

    public Guid? Id { get; init; }

    /// <summary>Only the pages whose site belongs to this owner.</summary>
    public string? OwnerId { get; init; }

    /// <summary>Only the pages after this one in menu order.</summary>
    public Guid? After { get; init; }

    public int Limit { get; init; } = 20;
}

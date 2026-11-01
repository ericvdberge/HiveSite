namespace Hivesite.Content.Domain;

/// <summary>Which stored blocks to read. A new way to filter is a new property here, not a new method.</summary>
public sealed record PageBlocksFilter
{
    public Guid? PageId { get; init; }

    /// <summary>Only the blocks of pages whose site belongs to this owner.</summary>
    public string? OwnerId { get; init; }
}

namespace Hivesite.Content.Domain;

/// <summary>Which sites to read. A new way to filter is a new property here, not a new method.</summary>
public sealed record SiteFilter
{
    public string? OwnerId { get; init; }

    public Guid? Id { get; init; }

    /// <summary>Only the sites after this one in list order: newest first, ties by id ascending.</summary>
    public Guid? After { get; init; }

    public int Limit { get; init; } = 20;
}

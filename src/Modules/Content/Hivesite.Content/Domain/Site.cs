namespace Hivesite.Content.Domain;

/// <summary>A site and its settings (API-001). Timestamps are UTC with second precision.</summary>
public sealed class Site
{
    public Guid Id { get; set; }
    public required string OwnerId { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public required string Language { get; set; }
    public required string Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

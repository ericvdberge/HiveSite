using Hivesite.Shared;

namespace Hivesite.Content.Domain;

/// <summary>A site and its settings (API-001).</summary>
public sealed class Site : IEntity, IAuditable
{
    public Guid Id { get; set; }

    public string OwnerId { get; set; } = "";

    public string Name { get; set; } = "";

    public string Slug { get; set; } = "";

    public string Language { get; set; } = "en";

    public string Description { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

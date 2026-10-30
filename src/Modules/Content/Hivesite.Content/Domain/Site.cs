namespace Hivesite.Content.Domain;

/// <summary>A site and its settings (API-001). A record, so a PATCH that changes nothing compares equal to the stored site.</summary>
public sealed record Site
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

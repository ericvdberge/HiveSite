namespace Hivesite.Content.Domain;

/// <summary>A page of a site (API-002). A record, so a PATCH that changes nothing compares equal to the stored page.</summary>
public sealed record Page
{
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    public string Title { get; set; } = "";

    public string Slug { get; set; } = "";

    public int MenuOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

namespace Hivesite.Content.Infrastructure;

/// <summary>A row of <c>content.sites</c>. Only the repository sees it; the rest of the module works with <see cref="Domain.Site"/>.</summary>
public sealed class SiteDao
{
    public Guid Id { get; set; }

    public string OwnerId { get; set; } = "";

    public string Name { get; set; } = "";

    public string Slug { get; set; } = "";

    public string Language { get; set; } = "";

    public string Description { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

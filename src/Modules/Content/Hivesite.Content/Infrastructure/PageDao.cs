namespace Hivesite.Content.Infrastructure;

/// <summary>A row of <c>content.pages</c>. Only the repository sees it; the rest of the module works with <see cref="Domain.Page"/>.</summary>
public sealed class PageDao
{
    public Guid Id { get; set; }

    public Guid SiteId { get; set; }

    public string Title { get; set; } = "";

    public string Slug { get; set; } = "";

    public int MenuOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

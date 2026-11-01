namespace Hivesite.Content.Infrastructure;

/// <summary>A row of <c>content.pageBlocks</c>: the document as jsonb text. Only the repository sees it.</summary>
public sealed class PageBlocksDao
{
    public Guid PageId { get; set; }

    public string Document { get; set; } = "";

    public int Version { get; set; }
}

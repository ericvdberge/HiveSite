namespace Hivesite.Content.Domain;

/// <summary>A site, its pages in menu order and their blocks, all read at one moment (API-011 Snapshot).</summary>
public sealed record SiteSnapshot(Site Site, IReadOnlyList<SnapshotPage> Pages);

/// <summary>A page with its stored blocks (the empty document when it has none).</summary>
public sealed record SnapshotPage(Page Page, PageBlocks Blocks);

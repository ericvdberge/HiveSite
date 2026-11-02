using System.Text.Json;

namespace Hivesite.Content.Contracts;

/// <summary>What Content offers other modules: the block type registry of API-003 and the site snapshot of API-011.</summary>
public interface IContentApi
{
    /// <summary>All block types in the fixed order of API-003.</summary>
    Task<IReadOnlyList<BlockTypeInfo>> ListBlockTypesAsync(CancellationToken cancellationToken = default);

    /// <summary>The snapshot of the site, or null when the site does not exist or belongs to another owner.</summary>
    Task<SiteSnapshot?> GetSiteSnapshotAsync(Guid siteId, CancellationToken cancellationToken = default);

    /// <summary>The id and slug of the site, or null when the site does not exist or belongs to another owner (API-020).</summary>
    Task<SiteSummary?> GetSiteSummaryAsync(Guid siteId, CancellationToken cancellationToken = default);

    /// <summary>The id of the site whose current slug is exactly <paramref name="slug"/>, whoever owns it, or null when unknown. No owner check: it serves public requests (API-020, API-021).</summary>
    Task<Guid?> GetSiteIdBySlugAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>The snapshot of the site that holds the page, or null when the page does not exist or its site belongs to another owner.</summary>
    Task<SiteSnapshot?> GetSiteSnapshotForPageAsync(Guid pageId, CancellationToken cancellationToken = default);
}

/// <summary>One block type. <c>Schema</c> is the complete JSON Schema (draft 2020-12) of a whole node.</summary>
public sealed record BlockTypeInfo(string Type, string Name, string Description, int Version, JsonElement Schema);

/// <summary>Everything a build reads (API-011 Snapshot). The members are in the order of the JSON; <c>SnapshotFormat</c> is 1.</summary>
public sealed record SiteSnapshot(int SnapshotFormat, SnapshotSite Site, IReadOnlyList<SnapshotPage> Pages)
{
    public const int Format = 1;
}

public sealed record SnapshotSite(string Id, string Name, string Slug, SnapshotSiteSettings Settings);

public sealed record SnapshotSiteSettings(string Language, string Description, string Theme);

/// <summary>A page in menu order. <c>Blocks</c> is the stored Tiptap document (API-004), the empty document when there is none.</summary>
public sealed record SnapshotPage(string Id, string Title, string Slug, int MenuOrder, DateTime CreatedAt, JsonElement Blocks);

/// <summary>The few facts about a site that Publishing needs (API-020).</summary>
public sealed record SiteSummary(string Id, string Slug);

namespace Hivesite.Content.Contracts;

/// <summary>
/// Raised after a page is created, a PATCH changed a value, a page is deleted (API-002), or its blocks changed (API-004).
/// <c>Change</c> is "created", "updated", "deleted" or "blocks".
/// </summary>
public sealed record PageChanged(string PageId, string SiteId, string Change)
{
    public const string Created = "created";
    public const string Updated = "updated";
    public const string Deleted = "deleted";
    public const string Blocks = "blocks";
}

/// <summary>Implemented by other modules that react to <see cref="PageChanged"/>.</summary>
public interface IPageChangedHandler
{
    Task HandleAsync(PageChanged change, CancellationToken cancellationToken);
}

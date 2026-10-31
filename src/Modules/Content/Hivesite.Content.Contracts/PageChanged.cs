namespace Hivesite.Content.Contracts;

/// <summary>Raised after a page is created, a PATCH changed a value, or a page is deleted (API-002). <c>Change</c> is "created", "updated" or "deleted".</summary>
public sealed record PageChanged(string PageId, string SiteId, string Change)
{
    public const string Created = "created";
    public const string Updated = "updated";
    public const string Deleted = "deleted";
}

/// <summary>Implemented by other modules that react to <see cref="PageChanged"/>.</summary>
public interface IPageChangedHandler
{
    Task HandleAsync(PageChanged change, CancellationToken cancellationToken);
}

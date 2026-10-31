namespace Hivesite.Content.Contracts;

/// <summary>Raised after a site is created or a PATCH changed a value (API-001). <c>Change</c> is "created" or "updated".</summary>
public sealed record SiteChanged(string SiteId, string Change)
{
    public const string Created = "created";
    public const string Updated = "updated";
}

/// <summary>Implemented by other modules that react to <see cref="SiteChanged"/>.</summary>
public interface ISiteChangedHandler
{
    Task HandleAsync(SiteChanged change, CancellationToken cancellationToken);
}

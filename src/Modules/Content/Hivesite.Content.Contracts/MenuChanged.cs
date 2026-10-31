namespace Hivesite.Content.Contracts;

/// <summary>Raised after the menu of a site changed (API-002): a page was added or deleted, or the order changed. <c>PageIds</c> is the new order.</summary>
public sealed record MenuChanged(string SiteId, IReadOnlyList<string> PageIds);

/// <summary>Implemented by other modules that react to <see cref="MenuChanged"/>.</summary>
public interface IMenuChangedHandler
{
    Task HandleAsync(MenuChanged change, CancellationToken cancellationToken);
}

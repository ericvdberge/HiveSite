using System.Text.Json.Nodes;
using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>The rules of API-004 for the blocks of one page of the signed-in owner. The check order of PUT is the order of this method.</summary>
internal sealed class PageBlocksService(
    PageBlocksRepository blocks,
    PageService pages,
    BlockDocumentValidator validator,
    UserContext user,
    ITimeService time,
    IEnumerable<IPageChangedHandler> pageHandlers)
{
    private static readonly Error PreconditionFailed = new("precondition_failed", "The blocks changed since you read them. Load them again.", "If-Match");

    /// <summary>Null when the page does not exist or its site belongs to another owner. A page without blocks has the empty document at version 1.</summary>
    public async Task<PageBlocks?> GetAsync(Guid pageId, CancellationToken ct) =>
        await pages.GetAsync(pageId, ct) is null ? null : await StoredAsync(pageId, ct);

    /// <summary>
    /// Replaces the document. Null when the page is not the owner's. <paramref name="expectedVersion"/> null overwrites whatever is stored.
    /// A document equal to the stored one writes nothing and raises nothing.
    /// </summary>
    public async Task<Result<PageBlocks>?> ReplaceAsync(Guid pageId, JsonNode? document, int? expectedVersion, CancellationToken ct)
    {
        if (await pages.GetAsync(pageId, ct) is not { } page)
        {
            return null;
        }

        var stored = await StoredAsync(pageId, ct);
        if (expectedVersion is { } expected && expected != stored.Version)
        {
            return PreconditionFailed;
        }

        var valid = validator.Validate(document);
        if (!valid.IsSuccess)
        {
            return valid.Error;
        }
        if (JsonNode.DeepEquals(valid.Value, stored.Document))
        {
            return stored;
        }

        var replaced = new PageBlocks { PageId = pageId, Document = valid.Value, Version = stored.Version + 1 };
        if (await blocks.SaveAsync(replaced, expectedVersion, time.UtcNow, ct) is not { } version)
        {
            return PreconditionFailed;
        }
        replaced.Version = version;   // what was written, also when another write came in between and there was no If-Match

        foreach (var handler in pageHandlers)
        {
            await handler.HandleAsync(new PageChanged(page.Id.ToString("D"), page.SiteId.ToString("D"), PageChanged.Blocks), ct);
        }
        return replaced;
    }

    private async Task<PageBlocks> StoredAsync(Guid pageId, CancellationToken ct) =>
        await blocks.GetAsync(new PageBlocksFilter { PageId = pageId, OwnerId = user.Id }, ct) ?? PageBlocks.Empty(pageId);
}

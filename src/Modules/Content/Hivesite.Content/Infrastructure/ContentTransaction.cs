using System.Data;
using Microsoft.EntityFrameworkCore;

namespace Hivesite.Content.Infrastructure;

/// <summary>
/// Runs reads in one transaction on the module's DbContext. The repositories share that context in a scope, so every read they
/// make inside see one moment. Not an entity's repository: it reads nothing itself.
/// </summary>
internal sealed class ContentTransaction(ContentDbContext db)
{
    /// <summary>Runs <paramref name="read"/> in one Repeatable Read transaction: commits by others after its first query are not visible to it.</summary>
    public async Task<T> ReadAsync<T>(Func<Task<T>> read, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var result = await read();
        await transaction.CommitAsync(ct);
        return result;
    }
}

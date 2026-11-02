using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Hivesite.Content.Tests;

/// <summary>
/// Records the transactions and queries of the code that runs inside <see cref="Record"/>, and can run a hook after the first query.
/// Registered as an EF Core interceptor in the test host; code outside <see cref="Record"/> is not recorded.
/// </summary>
internal sealed class DatabaseRecorder : DbCommandInterceptor
{
    private static readonly AsyncLocal<Recording?> Current = new();

    public static void Add(string text) => Current.Value?.Events.Add(text);

    public static Recording Record(Func<Task>? afterFirstQuery = null) => Current.Value = new Recording(afterFirstQuery);

    public override async ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
    {
        if (Current.Value is { } recording)
        {
            recording.Events.Add("query " + command.CommandText);
            if (!recording.HookRan && recording.AfterFirstQuery is { } hook)
            {
                recording.HookRan = true;
                Current.Value = null;   // what the hook does is not part of the recording
                await hook();
                Current.Value = recording;
            }
        }
        return result;
    }

    public sealed class Recording(Func<Task>? afterFirstQuery)
    {
        public List<string> Events { get; } = [];

        public Func<Task>? AfterFirstQuery { get; } = afterFirstQuery;

        public bool HookRan { get; set; }
    }
}

/// <summary>The transaction events of the same recording.</summary>
internal sealed class TransactionRecorder : DbTransactionInterceptor
{
    public override ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
        DbConnection connection, TransactionStartingEventData eventData, InterceptionResult<DbTransaction> result, CancellationToken cancellationToken = default)
    {
        DatabaseRecorder.Add("begin " + eventData.IsolationLevel);
        return ValueTask.FromResult(result);
    }

    public override ValueTask<InterceptionResult> TransactionCommittingAsync(
        DbTransaction transaction, TransactionEventData eventData, InterceptionResult result, CancellationToken cancellationToken = default)
    {
        DatabaseRecorder.Add("commit");
        return ValueTask.FromResult(result);
    }
}

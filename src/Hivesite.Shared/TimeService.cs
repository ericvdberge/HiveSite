namespace Hivesite.Shared;

/// <summary>The current time, UTC, truncated to whole seconds as every spec stores it.</summary>
public interface ITimeService
{
    DateTime UtcNow { get; }
}

internal sealed class TimeService(TimeProvider clock) : ITimeService
{
    public DateTime UtcNow
    {
        get
        {
            var now = clock.GetUtcNow().UtcDateTime;
            return now.AddTicks(-(now.Ticks % TimeSpan.TicksPerSecond));
        }
    }
}

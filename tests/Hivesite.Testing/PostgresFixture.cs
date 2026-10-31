using Microsoft.VisualStudio.TestTools.UnitTesting;
using Testcontainers.PostgreSql;

namespace Hivesite.Testing;

/// <summary>
/// A real PostgreSQL in a container, shared by the tests of one class or assembly.
/// Without Docker the tests that need it are inconclusive on a developer machine and fail in CI.
/// </summary>
public sealed class PostgresFixture : IAsyncDisposable
{
    private PostgreSqlContainer? _container;
    private string? _skipReason;

    public string ConnectionString =>
        _container?.GetConnectionString() ?? throw new InvalidOperationException("The PostgreSQL container is not running.");

    public async Task InitializeAsync()
    {
        try
        {
            _container = new PostgreSqlBuilder("postgres:17-alpine").Build();
            await _container.StartAsync();
        }
        catch (Exception ex) when (Environment.GetEnvironmentVariable("CI") is null)
        {
            _skipReason = $"PostgreSQL container did not start; is Docker running? {ex.Message}";
        }
    }

    /// <summary>Call first in every test that needs the database.</summary>
    public void SkipIfUnavailable()
    {
        if (_skipReason is not null)
        {
            Assert.Inconclusive(_skipReason);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }
}

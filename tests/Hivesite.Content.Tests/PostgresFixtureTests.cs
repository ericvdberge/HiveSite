using Hivesite.Testing;
using Npgsql;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class PostgresFixtureTests
{
    private static readonly PostgresFixture Postgres = new();

    [ClassInitialize]
    public static Task InitializeAsync(TestContext context) => Postgres.InitializeAsync();

    [ClassCleanup]
    public static ValueTask CleanupAsync() => Postgres.DisposeAsync();

    [TestMethod]
    public async Task The_fixture_serves_a_database_that_answers_queries()
    {
        Postgres.SkipIfUnavailable();

        await using var connection = new NpgsqlConnection(Postgres.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("select 1", connection);

        var result = await command.ExecuteScalarAsync();

        Assert.AreEqual(1, result);
    }
}

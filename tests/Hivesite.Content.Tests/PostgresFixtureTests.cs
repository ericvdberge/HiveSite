using Hivesite.Testing;
using Npgsql;

namespace Hivesite.Content.Tests;

public sealed class PostgresFixtureTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task The_fixture_serves_a_database_that_answers_queries()
    {
        postgres.SkipIfUnavailable();

        await using var connection = new NpgsqlConnection(postgres.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand("select 1", connection);

        var result = await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);

        Assert.Equal(1, result);
    }
}

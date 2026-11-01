using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Hivesite.Testing;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Hivesite.Host.Tests;

/// <summary>#118 (ADR 4): in Development the Host signs everyone in as the seeded admin and migrates and seeds at startup.</summary>
[TestClass]
public sealed class DevelopmentHostTests
{
    /// <summary>The admin owner of the Content dev seed (src/Modules/Content/CLAUDE.md, Dev seed).</summary>
    private const string SeededAdmin = "0198f1a0-0000-7000-8000-000000000001";

    private static readonly string[] AdminSiteSlugs = ["dev-atelier-nord", "dev-atelier-full", "dev-atelier-empty"];

    private static readonly PostgresFixture Postgres = new();

    [ClassInitialize]
    public static Task InitializeAsync(TestContext _) => Postgres.InitializeAsync();

    [ClassCleanup]
    public static Task CleanupAsync() => Postgres.DisposeAsync().AsTask();

    /// <summary>The Host in <paramref name="environment"/> on its own database, which nothing has created yet.</summary>
    private static WebApplicationFactory<Program> OnOwnDatabase(string environment, string database, string? seed = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("ConnectionStrings:Content", ConnectionTo(database));
            if (seed is not null)
            {
                builder.UseSetting("Dev:Seed", seed);
            }
        });

    private static string ConnectionTo(string database) =>
        new NpgsqlConnectionStringBuilder(Postgres.ConnectionString) { Database = database }.ConnectionString;

    private static async Task<long> ScalarAsync(string sql, string? database = null)
    {
        await using var connection = new NpgsqlConnection(database is null ? Postgres.ConnectionString : ConnectionTo(database));
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(), CultureInfo.InvariantCulture);
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(WebApplicationFactory<Program> factory, string path)
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative));
        return (response.StatusCode, JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone());
    }

    [TestMethod]
    public async Task In_Development_the_signed_in_user_is_the_seeded_admin_AC1()
    {
        await using var factory = HostFactory.WithoutDatabase();
        await using var scope = factory.Services.CreateAsyncScope();
        var http = new DefaultHttpContext { RequestServices = scope.ServiceProvider };

        var result = await http.AuthenticateAsync();

        Assert.IsTrue(result.Succeeded);
        Assert.AreEqual(SeededAdmin, result.Principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    [TestMethod]
    public async Task In_Development_a_request_without_credentials_is_signed_in_as_the_seeded_admin_AC1()
    {
        Postgres.SkipIfUnavailable();
        await using var factory = OnOwnDatabase("Development", "dev_sign_in");

        var (status, body) = await GetAsync(factory, "/sites");

        Assert.AreEqual(HttpStatusCode.OK, status);
        CollectionAssert.AreEquivalent(
            AdminSiteSlugs,
            body.GetProperty("items").EnumerateArray().Select(s => s.GetProperty("slug").GetString()).ToArray());
    }

    [TestMethod]
    [DataRow("Production")]
    [DataRow("Staging")]
    public async Task Outside_Development_a_request_without_credentials_is_401_AC1(string environment)
    {
        await using var factory = HostFactory.WithoutDatabase(environment);

        var (status, body) = await GetAsync(factory, "/sites");

        Assert.AreEqual(HttpStatusCode.Unauthorized, status);
        Assert.AreEqual("unauthenticated", body.GetProperty("error").GetProperty("code").GetString());
    }

    [TestMethod]
    public async Task Development_startup_migrates_and_seeds_by_default_AC2()
    {
        Postgres.SkipIfUnavailable();
        await using var factory = OnOwnDatabase("Development", "dev_startup_seed");

        _ = factory.Services;   // starts the Host

        Assert.AreEqual(4, await ScalarAsync("select count(*) from content.sites", "dev_startup_seed"));
        Assert.AreEqual(4 + 49 + 2, await ScalarAsync("select count(*) from content.pages", "dev_startup_seed"));
    }

    [TestMethod]
    public async Task Development_startup_with_Dev_Seed_false_migrates_without_seeding_AC2()
    {
        Postgres.SkipIfUnavailable();
        await using var factory = OnOwnDatabase("Development", "dev_startup_no_seed", seed: "false");

        _ = factory.Services;

        Assert.AreEqual(0, await ScalarAsync("select count(*) from content.sites", "dev_startup_no_seed"));
    }

    [TestMethod]
    [DataRow("Production")]
    [DataRow("Staging")]
    public async Task Startup_outside_Development_never_migrates_or_seeds_AC2(string environment)
    {
        Postgres.SkipIfUnavailable();
        var database = "startup_" + environment.ToLowerInvariant();
        await using var factory = OnOwnDatabase(environment, database, seed: "true");

        _ = factory.Services;

        Assert.AreEqual(0, await ScalarAsync($"select count(*) from pg_database where datname = '{database}'"));
    }
}

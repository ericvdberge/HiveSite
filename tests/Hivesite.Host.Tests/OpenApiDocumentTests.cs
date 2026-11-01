using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hivesite.Host.Tests;

/// <summary>
/// The committed <c>openapi/hivesite.v1.json</c> is what the running Host serves. The studio's client is generated from that file.
/// After an API change, regenerate it with <c>UPDATE_OPENAPI=1 dotnet test --project tests/Hivesite.Host.Tests</c> and commit the result.
/// No database is needed: the document is built from endpoint metadata.
/// </summary>
[TestClass]
public sealed class OpenApiDocumentTests
{
    private const string DocumentPath = "/openapi/v1.json";

    [TestMethod]
    public async Task The_committed_document_matches_the_running_Host()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development"));
        using var client = factory.CreateClient();

        var served = Normalize(await client.GetStringAsync(new Uri(DocumentPath, UriKind.Relative)));
        var path = CommittedPath();

        if (Environment.GetEnvironmentVariable("UPDATE_OPENAPI") == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllTextAsync(path, served);
        }

        Assert.IsTrue(File.Exists(path), $"{path} is missing. Run UPDATE_OPENAPI=1 dotnet test --project tests/Hivesite.Host.Tests.");
        var committed = Normalize(await File.ReadAllTextAsync(path));
        Assert.AreEqual(committed, served, "openapi/hivesite.v1.json is out of date. Run UPDATE_OPENAPI=1 dotnet test --project tests/Hivesite.Host.Tests and commit it.");
    }

    [TestMethod]
    [DataRow("Production")]
    [DataRow("Staging")]
    public async Task The_document_is_not_served_outside_Development(string environment)
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment(environment));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(DocumentPath, UriKind.Relative));

        Assert.AreEqual(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static string Normalize(string text) => text.ReplaceLineEndings("\n").TrimEnd() + "\n";

    private static string CommittedPath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Hivesite.slnx")))
        {
            dir = dir.Parent;
        }
        Assert.IsNotNull(dir, "Hivesite.slnx not found above the test output folder.");
        return Path.Combine(dir.FullName, "openapi", "hivesite.v1.json");
    }
}

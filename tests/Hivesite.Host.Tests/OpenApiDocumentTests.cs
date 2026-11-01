using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hivesite.Host.Tests;

/// <summary>
/// <c>dotnet build</c> writes <c>openapi/hivesite.json</c> from the Host's endpoint metadata; it is git-ignored and never edited.
/// These tests check that the build output is what the running Host serves, and that the Host serves it in Development only.
/// No database is needed: the document is built from endpoint metadata.
/// </summary>
[TestClass]
public sealed class OpenApiDocumentTests
{
    private const string DocumentPath = "/openapi/v1.json";

    [TestMethod]
    public async Task The_build_output_is_what_the_running_Host_serves()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development"));
        using var client = factory.CreateClient();

        var served = Normalize(await client.GetStringAsync(new Uri(DocumentPath, UriKind.Relative)));
        var path = BuildOutputPath();

        Assert.IsTrue(File.Exists(path), $"{path} is missing. Run dotnet build; it writes the document.");
        Assert.AreEqual(Normalize(await File.ReadAllTextAsync(path)), served, "openapi/hivesite.json differs from what the Host serves. Run dotnet build.");
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

    private static string BuildOutputPath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Hivesite.slnx")))
        {
            dir = dir.Parent;
        }
        Assert.IsNotNull(dir, "Hivesite.slnx not found above the test output folder.");
        return Path.Combine(dir.FullName, "openapi", "hivesite.json");
    }
}

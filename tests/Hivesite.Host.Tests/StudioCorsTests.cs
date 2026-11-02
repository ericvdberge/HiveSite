using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hivesite.Host.Tests;

/// <summary>#49: the studio's origin passes CORS preflight, nothing else does.</summary>
[TestClass]
public sealed class StudioCorsTests
{
    private const string StudioDevServer = "http://localhost:5173";

    [TestMethod]
    public async Task A_preflight_from_a_listed_origin_passes_with_credentials()
    {
        await using var factory = HostFactory.WithoutDatabase();

        using var response = await PreflightAsync(factory, StudioDevServer);

        Assert.IsTrue(response.IsSuccessStatusCode, $"Preflight returned {(int)response.StatusCode}.");
        Assert.AreEqual(StudioDevServer, Header(response, "Access-Control-Allow-Origin"));
        Assert.AreEqual("true", Header(response, "Access-Control-Allow-Credentials"));
        StringAssert.Contains(Header(response, "Access-Control-Allow-Methods"), "POST");
    }

    [TestMethod]
    public async Task A_request_from_a_listed_origin_may_read_the_ETag()
    {
        await using var factory = HostFactory.WithoutDatabase();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/block-types");
        request.Headers.Add("Origin", StudioDevServer);

        using var response = await client.SendAsync(request);

        Assert.AreEqual(StudioDevServer, Header(response, "Access-Control-Allow-Origin"));
        StringAssert.Contains(Header(response, "Access-Control-Expose-Headers"), "ETag");
    }

    [TestMethod]
    public async Task A_preflight_from_an_unlisted_origin_gets_no_cors_headers()
    {
        await using var factory = HostFactory.WithoutDatabase();

        using var response = await PreflightAsync(factory, "https://evil.example");

        Assert.IsNull(Header(response, "Access-Control-Allow-Origin"));
        Assert.IsNull(Header(response, "Access-Control-Allow-Credentials"));
    }

    [TestMethod]
    public async Task No_configured_origins_allow_no_cross_origin_calls()
    {
        await using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Production"));

        using var response = await PreflightAsync(factory, StudioDevServer);

        Assert.IsNull(Header(response, "Access-Control-Allow-Origin"));
    }

    private static async Task<HttpResponseMessage> PreflightAsync(WebApplicationFactory<Program> factory, string origin)
    {
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/sites");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        return await client.SendAsync(request);
    }

    private static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : null;
}

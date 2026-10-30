using System.Collections.Concurrent;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Hivesite.Content.Contracts;
using Hivesite.Shared;
using Hivesite.Testing;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hivesite.Content.Tests;

/// <summary>Test-only sign-in: the X-Test-Owner header is the user id, no header means nobody is signed in.</summary>
internal sealed class HeaderAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : UserAuthenticationHandler(options, logger, encoder)
{
    public const string Header = "X-Test-Owner";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Headers[Header].FirstOrDefault() is not { } owner)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, owner)], Scheme.Name));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(user, Scheme.Name)));
    }
}

internal sealed class RecordingHandler : ISiteChangedHandler
{
    public ConcurrentQueue<SiteChanged> Raised { get; } = new();

    public Task HandleAsync(SiteChanged change, CancellationToken cancellationToken)
    {
        Raised.Enqueue(change);
        return Task.CompletedTask;
    }
}

/// <summary>Real time plus an offset that only grows, or a frozen instant, so tests control the second.</summary>
internal sealed class TestClock : TimeProvider
{
    private DateTimeOffset? _frozen;
    private TimeSpan _offset;

    public override DateTimeOffset GetUtcNow() => _frozen ?? DateTimeOffset.UtcNow + _offset;

    public void Advance(TimeSpan by) => _offset += by;

    public void Freeze() => _frozen = GetUtcNow();

    public void Unfreeze() => _frozen = null;
}

public sealed record ApiResponse(HttpStatusCode Status, JsonElement Body, HttpResponseMessage Raw)
{
    public string Text(params string[] path) => Node(path).GetString()!;

    public JsonElement Node(params string[] path) => path.Aggregate(Body, (e, p) => e.GetProperty(p));

    public string? ErrorField => Body.GetProperty("error").TryGetProperty("field", out var f) ? f.GetString() : null;

    public string ErrorCode => Body.GetProperty("error").GetProperty("code").GetString()!;
}

/// <summary>The app over HTTP against a real PostgreSQL, shared by every Content API test.</summary>
[TestClass]
public sealed class ContentApi : IAsyncDisposable
{
    private static readonly ContentApi Shared = new();
    private static readonly PostgresFixture Postgres = new();
    private WebApplicationFactory<Program>? _factory;

    internal RecordingHandler Events { get; } = new();

    internal TestClock Clock { get; } = new();

    [AssemblyInitialize]
    public static Task InitializeAsync(TestContext context) => Postgres.InitializeAsync();

    [AssemblyCleanup]
    public static async Task CleanupAsync()
    {
        await Shared.DisposeAsync();
        await Postgres.DisposeAsync();
    }

    /// <summary>Call first in every test: inconclusive without Docker, otherwise boots the app once.</summary>
    public static async Task<ContentApi> ReadyAsync()
    {
        var api = Shared;
        Postgres.SkipIfUnavailable();
        if (api._factory is null)
        {
            api._factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:Content", Postgres.ConnectionString);
                builder.ConfigureServices(services =>
                {
                    services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, HeaderAuthenticationHandler>("Test", null);
                    services.AddSingleton<ISiteChangedHandler>(api.Events);
                    services.AddSingleton<TimeProvider>(api.Clock);
                });
            });
            await api._factory.Services.MigrateContentDatabaseAsync();
        }
        return api;
    }

    public static string NewOwner() => "owner-" + Guid.NewGuid().ToString("N");

    public static string NewSlug() => "s" + Guid.NewGuid().ToString("N")[..12];

    public int RaisedFor(string siteId) => Events.Raised.Count(e => e.SiteId == siteId);

    public async Task<ApiResponse> SendAsync(
        HttpMethod method, string path, string? owner, string? json = null, params (string Name, string Value)[] headers)
    {
        using var client = _factory!.CreateClient();
        using var request = new HttpRequestMessage(method, path);
        if (owner is not null)
        {
            request.Headers.Add(HeaderAuthenticationHandler.Header, owner);
        }
        foreach (var (name, value) in headers)
        {
            request.Headers.TryAddWithoutValidation(name, value);
        }
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        var body = text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone();
        return new ApiResponse(response.StatusCode, body, response);
    }

    public Task<ApiResponse> PostAsync(string? owner, string json, params (string Name, string Value)[] headers) =>
        SendAsync(HttpMethod.Post, "/sites", owner, json, headers);

    public Task<ApiResponse> PatchAsync(string? owner, string id, string json) =>
        SendAsync(HttpMethod.Patch, "/sites/" + id, owner, json);

    public Task<ApiResponse> GetAsync(string? owner, string path) => SendAsync(HttpMethod.Get, path, owner);

    /// <summary>Creates a site with a fresh slug and returns the created body.</summary>
    public async Task<ApiResponse> CreateAsync(string owner, string? settings = null)
    {
        var json = $$"""{"name":"Site","slug":"{{NewSlug()}}"{{(settings is null ? "" : ",\"settings\":" + settings)}}}""";
        var response = await PostAsync(owner, json);
        Assert.AreEqual(HttpStatusCode.Created, response.Status);
        return response;
    }

    public async ValueTask DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }
}

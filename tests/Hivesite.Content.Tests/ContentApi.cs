using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Hivesite.Content.Contracts;
using Hivesite.Content.Endpoints;
using Hivesite.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Tests;

/// <summary>Test-only owner resolver: the owner id is the X-Test-Owner header, no header means no owner.</summary>
internal sealed class HeaderOwnerResolver : IOwnerResolver
{
    public const string Header = "X-Test-Owner";

    public string? Resolve(HttpContext context) => context.Request.Headers[Header].FirstOrDefault();
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
public sealed class ContentApi : IAsyncLifetime
{
    private readonly PostgresFixture _postgres = new();
    private WebApplicationFactory<Program>? _factory;

    internal RecordingHandler Events { get; } = new();

    internal TestClock Clock { get; } = new();

    public async ValueTask InitializeAsync() => await _postgres.InitializeAsync();

    /// <summary>Call first in every test: skips without Docker, otherwise boots the app once.</summary>
    public async Task<ContentApi> ReadyAsync()
    {
        _postgres.SkipIfUnavailable();
        if (_factory is null)
        {
            _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:Content", _postgres.ConnectionString);
                builder.ConfigureServices(services =>
                {
                    services.AddSingleton<IOwnerResolver, HeaderOwnerResolver>();
                    services.AddSingleton<ISiteChangedHandler>(Events);
                    services.AddSingleton<TimeProvider>(Clock);
                });
            });
            await _factory.Services.MigrateContentDatabaseAsync();
        }
        return this;
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
            request.Headers.Add(HeaderOwnerResolver.Header, owner);
        }
        foreach (var (name, value) in headers)
        {
            request.Headers.TryAddWithoutValidation(name, value);
        }
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
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
        Assert.Equal(HttpStatusCode.Created, response.Status);
        return response;
    }

    public async ValueTask DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
        await _postgres.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ContentApiDefinition : ICollectionFixture<ContentApi>
{
    public const string Name = "content-api";
}

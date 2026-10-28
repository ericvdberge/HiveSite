using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Hivesite.Content.Tests;

[Collection(ContentApiDefinition.Name)]
public sealed partial class CreateSiteTests(ContentApi fixture)
{
    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$")]
    private static partial Regex Uuid7();

    [GeneratedRegex(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")]
    private static partial Regex Timestamp();

    private static string Json(string name = "Atelier Noor", string? slug = null, string? settings = null) =>
        $$"""{"name":{{JsonSerializer.Serialize(name)}},"slug":"{{slug ?? ContentApi.NewSlug()}}"{{(settings is null ? "" : ",\"settings\":" + settings)}}}""";

    [Fact]
    public async Task Creates_a_site_with_Location_AC1()
    {
        var api = await fixture.ReadyAsync();
        var slug = ContentApi.NewSlug();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug, settings: """{"language":"nl","description":"Ceramics."}"""));

        Assert.Equal(HttpStatusCode.Created, response.Status);
        Assert.Equal("Atelier Noor", response.Text("name"));
        Assert.Equal(slug, response.Text("slug"));
        Assert.Equal("nl", response.Text("settings", "language"));
        Assert.Equal("Ceramics.", response.Text("settings", "description"));
        Assert.Equal($"/sites/{response.Text("id")}", response.Raw.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Missing_settings_get_defaults_AC2()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var bare = await api.PostAsync(owner, Json());
        var partial = await api.PostAsync(owner, Json(settings: """{"language":"de"}"""));
        var other = await api.PostAsync(owner, Json(settings: """{"description":"Hi"}"""));

        Assert.Equal("en", bare.Text("settings", "language"));
        Assert.Equal("", bare.Text("settings", "description"));
        Assert.Equal("de", partial.Text("settings", "language"));
        Assert.Equal("", partial.Text("settings", "description"));
        Assert.Equal("en", other.Text("settings", "language"));
        Assert.Equal("Hi", other.Text("settings", "description"));
    }

    [Fact]
    public async Task The_response_shape_is_stable_AC3()
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json());

        Assert.Matches(Uuid7(), response.Text("id"));
        Assert.Matches(Timestamp(), response.Text("created_at"));
        Assert.Equal(response.Text("created_at"), response.Text("updated_at"));
        Assert.Equal(["id", "name", "slug", "settings", "created_at", "updated_at"], response.Body.EnumerateObject().Select(p => p.Name));
        Assert.Equal(["language", "description"], response.Node("settings").EnumerateObject().Select(p => p.Name));
        Assert.DoesNotContain(response.Body.EnumerateObject(), p => p.Value.ValueKind == JsonValueKind.Null);
    }

    [Fact]
    public async Task Stores_and_returns_trimmed_values_AC4()
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(name: "  Atelier  ", settings: """{"description":"  Hello \n"}"""));

        Assert.Equal("Atelier", response.Text("name"));
        Assert.Equal("Hello", response.Text("settings", "description"));
    }

    [Fact]
    public async Task An_80_emoji_name_is_accepted_and_81_is_not_AC4()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var ok = await api.PostAsync(owner, Json(name: string.Concat(Enumerable.Repeat("\U0001F600", 80))));
        var tooLong = await api.PostAsync(owner, Json(name: string.Concat(Enumerable.Repeat("\U0001F600", 81))));

        Assert.Equal(HttpStatusCode.Created, ok.Status);
        Assert.Equal("/name", tooLong.ErrorField);
    }

    [Theory]
    [InlineData("""{"name":"A","slug":"abc","extra":1}""", "/extra")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"extra":1}}""", "/settings/extra")]
    [InlineData("""{"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A","slug":null}""", "/slug")]
    [InlineData("""{"name":5,"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A","slug":"ab"}""", "/slug")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"language":"en_US"}}""", "/settings/language")]
    public async Task Invalid_bodies_return_400_with_the_field_AC5_AC6(string body, string field)
    {
        var api = await fixture.ReadyAsync();
        var response = await api.PostAsync(ContentApi.NewOwner(), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_request", response.ErrorCode);
        Assert.Equal(field, response.ErrorField);
    }

    [Theory]
    [InlineData("{")]
    [InlineData("")]
    [InlineData("[]")]
    public async Task Malformed_JSON_has_no_field_AC5(string body)
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), body);

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_request", response.ErrorCode);
        Assert.Null(response.ErrorField);
    }

    [Fact]
    public async Task A_description_over_160_is_refused_AC6()
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(settings: $$"""{"description":"{{new string('d', 161)}}"}"""));

        Assert.Equal("/settings/description", response.ErrorField);
    }

    [Fact]
    public async Task A_failed_request_stores_nothing_AC5()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();

        await api.PostAsync(owner, """{"name":"A","slug":"abc","extra":1}""");
        var list = await api.GetAsync(owner, "/sites");

        Assert.Empty(list.Node("items").EnumerateArray());
    }

    [Fact]
    public async Task Limits_are_inclusive_AC6()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var longSlug = "l" + Guid.NewGuid().ToString("N") + "abcdefg";

        var response = await api.PostAsync(owner, Json(name: new string('n', 80), slug: longSlug[..40],
            settings: $$"""{"description":"{{new string('d', 160)}}"}"""));
        var shortest = await api.PostAsync(owner, Json(slug: "a" + Guid.NewGuid().ToString("N")[..1] + "b"));

        Assert.Equal(HttpStatusCode.Created, response.Status);
        Assert.Equal(HttpStatusCode.Created, shortest.Status);
    }

    [Fact]
    public async Task A_slug_used_by_any_owner_is_taken_AC7()
    {
        var api = await fixture.ReadyAsync();
        var slug = ContentApi.NewSlug();
        await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug));

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug));

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("slug_taken", response.ErrorCode);
        Assert.Equal("/slug", response.ErrorField);
    }

    [Fact]
    public async Task The_eleventh_site_is_refused_AC8()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        for (var i = 0; i < 10; i++)
        {
            await api.CreateAsync(owner);
        }

        var eleventh = await api.PostAsync(owner, Json());
        var other = await api.PostAsync(ContentApi.NewOwner(), Json());

        Assert.Equal(HttpStatusCode.BadRequest, eleventh.Status);
        Assert.Equal("too_many_sites", eleventh.ErrorCode);
        Assert.Null(eleventh.ErrorField);
        Assert.Equal(HttpStatusCode.Created, other.Status);
    }

    [Fact]
    public async Task The_same_key_and_body_replays_the_first_response_AC9()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var key = ("Idempotency-Key", Guid.NewGuid().ToString());
        var body = Json();

        var first = await api.PostAsync(owner, body, key);
        var second = await api.PostAsync(owner, body, key);
        var list = await api.GetAsync(owner, "/sites");

        Assert.Equal(HttpStatusCode.Created, second.Status);
        Assert.Equal(first.Text("id"), second.Text("id"));
        Assert.Equal(first.Raw.Headers.Location, second.Raw.Headers.Location);
        Assert.Equal(first.Body.GetRawText(), second.Body.GetRawText());
        Assert.Single(list.Node("items").EnumerateArray());
        Assert.Equal(1, api.RaisedFor(first.Text("id")));
    }

    [Fact]
    public async Task A_key_with_a_different_body_is_refused_and_keys_are_per_owner_AC10()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var key = ("Idempotency-Key", Guid.NewGuid().ToString());
        await api.PostAsync(owner, Json(), key);

        var reused = await api.PostAsync(owner, Json(name: "Another"), key);
        var otherOwner = await api.PostAsync(ContentApi.NewOwner(), Json(name: "Another"), key);

        Assert.Equal(HttpStatusCode.BadRequest, reused.Status);
        Assert.Equal("idempotency_key_reused", reused.ErrorCode);
        Assert.Equal("Idempotency-Key", reused.ErrorField);
        Assert.Equal(HttpStatusCode.Created, otherOwner.Status);
    }

    [Theory]
    [InlineData("tab\tkey")]
    [InlineData("sl\u00e9utel")]
    public async Task A_malformed_key_is_invalid_AC10(string key)
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(), ("Idempotency-Key", key));

        Assert.Equal("invalid_request", response.ErrorCode);
        Assert.Equal("Idempotency-Key", response.ErrorField);
    }

    [Fact]
    public async Task A_key_over_255_characters_is_invalid_and_255_is_fine_AC10()
    {
        var api = await fixture.ReadyAsync();

        var tooLong = await api.PostAsync(ContentApi.NewOwner(), Json(), ("Idempotency-Key", new string('k', 256)));
        var longest = await api.PostAsync(ContentApi.NewOwner(), Json(), ("Idempotency-Key", new string('k', 255)));

        Assert.Equal("Idempotency-Key", tooLong.ErrorField);
        Assert.Equal(HttpStatusCode.Created, longest.Status);
    }

    [Fact]
    public async Task Without_a_key_every_post_creates_AC10()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var first = await api.PostAsync(owner, Json());
        var second = await api.PostAsync(owner, Json());

        Assert.Equal(HttpStatusCode.Created, second.Status);
        Assert.NotEqual(first.Text("id"), second.Text("id"));
    }

    [Fact]
    public async Task A_key_is_forgotten_after_24_hours_AC10()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var key = ("Idempotency-Key", Guid.NewGuid().ToString());
        await api.PostAsync(owner, Json(), key);

        api.Clock.Advance(TimeSpan.FromHours(25));
        var again = await api.PostAsync(owner, Json(name: "Another"), key);

        Assert.Equal(HttpStatusCode.Created, again.Status);
    }

    [Fact]
    public async Task Without_an_owner_POST_is_unauthenticated_AC11()
    {
        var api = await fixture.ReadyAsync();

        var response = await api.PostAsync(null, Json());

        Assert.Equal(HttpStatusCode.Unauthorized, response.Status);
        Assert.Equal("unauthenticated", response.ErrorCode);
        Assert.Null(response.ErrorField);
    }

    [Fact]
    public async Task A_created_site_raises_SiteChanged_once_and_a_failure_raises_nothing_AC23()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var before = api.Events.Raised.Count;

        var created = await api.PostAsync(owner, Json());
        await api.PostAsync(owner, """{"name":"A"}""");

        Assert.Equal(before + 1, api.Events.Raised.Count);
        Assert.Contains(api.Events.Raised, e => e.SiteId == created.Text("id") && e.Change == "created");
    }

    [Fact]
    public async Task Concurrent_posts_with_one_slug_create_exactly_one_site_AC24()
    {
        var api = await fixture.ReadyAsync();
        var slug = ContentApi.NewSlug();

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => api.PostAsync(ContentApi.NewOwner(), Json(slug: slug))));

        Assert.Single(responses, r => r.Status == HttpStatusCode.Created);
        Assert.All(responses.Where(r => r.Status != HttpStatusCode.Created), r => Assert.Equal("slug_taken", r.ErrorCode));
    }

    [Fact]
    public async Task Concurrent_posts_by_one_owner_never_exceed_ten_sites_AC24()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var responses = await Task.WhenAll(Enumerable.Range(0, 14).Select(_ => api.PostAsync(owner, Json())));
        var list = await api.GetAsync(owner, "/sites?limit=100");

        Assert.Equal(10, responses.Count(r => r.Status == HttpStatusCode.Created));
        Assert.All(responses.Where(r => r.Status != HttpStatusCode.Created), r => Assert.Equal("too_many_sites", r.ErrorCode));
        Assert.Equal(10, list.Node("items").GetArrayLength());
    }
}

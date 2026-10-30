using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed partial class CreateSiteTests
{
    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$")]
    private static partial Regex Uuid7();

    [GeneratedRegex(@"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")]
    private static partial Regex Timestamp();

    private static readonly string[] SiteFields = ["id", "name", "slug", "settings", "created_at", "updated_at"];
    private static readonly string[] SettingsFields = ["language", "description"];

    private static string Json(string name = "Atelier Noor", string? slug = null, string? settings = null) =>
        $$"""{"name":{{JsonSerializer.Serialize(name)}},"slug":"{{slug ?? ContentApi.NewSlug()}}"{{(settings is null ? "" : ",\"settings\":" + settings)}}}""";

    [TestMethod]
    public async Task Creates_a_site_with_Location_AC1()
    {
        var api = await ContentApi.ReadyAsync();
        var slug = ContentApi.NewSlug();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug, settings: """{"language":"nl","description":"Ceramics."}"""));

        Assert.AreEqual(HttpStatusCode.Created, response.Status);
        Assert.AreEqual("Atelier Noor", response.Text("name"));
        Assert.AreEqual(slug, response.Text("slug"));
        Assert.AreEqual("nl", response.Text("settings", "language"));
        Assert.AreEqual("Ceramics.", response.Text("settings", "description"));
        Assert.AreEqual($"/sites/{response.Text("id")}", response.Raw.Headers.Location!.ToString());
    }

    [TestMethod]
    public async Task Missing_settings_get_defaults_AC2()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var bare = await api.PostAsync(owner, Json());
        var partial = await api.PostAsync(owner, Json(settings: """{"language":"de"}"""));
        var other = await api.PostAsync(owner, Json(settings: """{"description":"Hi"}"""));

        Assert.AreEqual("en", bare.Text("settings", "language"));
        Assert.AreEqual("", bare.Text("settings", "description"));
        Assert.AreEqual("de", partial.Text("settings", "language"));
        Assert.AreEqual("", partial.Text("settings", "description"));
        Assert.AreEqual("en", other.Text("settings", "language"));
        Assert.AreEqual("Hi", other.Text("settings", "description"));
    }

    [TestMethod]
    public async Task The_response_shape_is_stable_AC3()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json());

        Assert.MatchesRegex(Uuid7(), response.Text("id"));
        Assert.MatchesRegex(Timestamp(), response.Text("created_at"));
        Assert.AreEqual(response.Text("created_at"), response.Text("updated_at"));
        CollectionAssert.AreEqual(SiteFields, response.Body.EnumerateObject().Select(p => p.Name).ToList());
        CollectionAssert.AreEqual(SettingsFields, response.Node("settings").EnumerateObject().Select(p => p.Name).ToList());
        Assert.DoesNotContain(p => p.Value.ValueKind == JsonValueKind.Null, response.Body.EnumerateObject());
    }

    [TestMethod]
    public async Task Stores_and_returns_trimmed_values_AC4()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(name: "  Atelier  ", settings: """{"description":"  Hello \n"}"""));

        Assert.AreEqual("Atelier", response.Text("name"));
        Assert.AreEqual("Hello", response.Text("settings", "description"));
    }

    [TestMethod]
    public async Task An_80_emoji_name_is_accepted_and_81_is_not_AC4()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var ok = await api.PostAsync(owner, Json(name: string.Concat(Enumerable.Repeat("\U0001F600", 80))));
        var tooLong = await api.PostAsync(owner, Json(name: string.Concat(Enumerable.Repeat("\U0001F600", 81))));

        Assert.AreEqual(HttpStatusCode.Created, ok.Status);
        Assert.AreEqual("/name", tooLong.ErrorField);
    }

    [TestMethod]
    [DataRow("""{"name":"A","slug":"abc","extra":1}""", "/extra")]
    [DataRow("""{"name":"A","slug":"abc","settings":{"extra":1}}""", "/settings/extra")]
    [DataRow("""{"slug":"abc"}""", "/name")]
    [DataRow("""{"name":"A","slug":null}""", "/slug")]
    [DataRow("""{"name":5,"slug":"abc"}""", "/name")]
    [DataRow("""{"name":"A","slug":"ab"}""", "/slug")]
    [DataRow("""{"name":"A","slug":"abc","settings":{"language":"en_US"}}""", "/settings/language")]
    public async Task Invalid_bodies_return_400_with_the_field_AC5_AC6(string body, string field)
    {
        var api = await ContentApi.ReadyAsync();
        var response = await api.PostAsync(ContentApi.NewOwner(), body);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual(field, response.ErrorField);
    }

    [TestMethod]
    [DataRow("{")]
    [DataRow("")]
    [DataRow("[]")]
    public async Task Malformed_JSON_has_no_field_AC5(string body)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), body);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.IsNull(response.ErrorField);
    }

    [TestMethod]
    public async Task A_description_over_160_is_refused_AC6()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(settings: $$"""{"description":"{{new string('d', 161)}}"}"""));

        Assert.AreEqual("/settings/description", response.ErrorField);
    }

    [TestMethod]
    public async Task A_failed_request_stores_nothing_AC5()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();

        await api.PostAsync(owner, """{"name":"A","slug":"abc","extra":1}""");
        var list = await api.GetAsync(owner, "/sites");

        Assert.IsEmpty(list.Node("items").EnumerateArray());
    }

    [TestMethod]
    public async Task Limits_are_inclusive_AC6()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var longSlug = "l" + Guid.NewGuid().ToString("N") + "abcdefg";

        var response = await api.PostAsync(owner, Json(name: new string('n', 80), slug: longSlug[..40],
            settings: $$"""{"description":"{{new string('d', 160)}}"}"""));
        var shortest = await api.PostAsync(owner, Json(slug: "a" + Guid.NewGuid().ToString("N")[..1] + "b"));

        Assert.AreEqual(HttpStatusCode.Created, response.Status);
        Assert.AreEqual(HttpStatusCode.Created, shortest.Status);
    }

    [TestMethod]
    public async Task A_slug_used_by_any_owner_is_taken_AC7()
    {
        var api = await ContentApi.ReadyAsync();
        var slug = ContentApi.NewSlug();
        await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug));

        var response = await api.PostAsync(ContentApi.NewOwner(), Json(slug: slug));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("slug_taken", response.ErrorCode);
        Assert.AreEqual("/slug", response.ErrorField);
    }

    [TestMethod]
    public async Task The_eleventh_site_is_refused_AC8()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        for (var i = 0; i < 10; i++)
        {
            await api.CreateAsync(owner);
        }

        var eleventh = await api.PostAsync(owner, Json());
        var other = await api.PostAsync(ContentApi.NewOwner(), Json());

        Assert.AreEqual(HttpStatusCode.BadRequest, eleventh.Status);
        Assert.AreEqual("too_many_sites", eleventh.ErrorCode);
        Assert.IsNull(eleventh.ErrorField);
        Assert.AreEqual(HttpStatusCode.Created, other.Status);
    }

    [TestMethod]
    public async Task Without_an_owner_POST_is_unauthenticated_AC11()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.PostAsync(null, Json());

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.Status);
        Assert.AreEqual("unauthenticated", response.ErrorCode);
        Assert.IsNull(response.ErrorField);
    }

    [TestMethod]
    public async Task A_created_site_raises_SiteChanged_once_and_a_failure_raises_nothing_AC23()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var before = api.Events.Raised.Count;

        var created = await api.PostAsync(owner, Json());
        await api.PostAsync(owner, """{"name":"A"}""");

        Assert.AreEqual(before + 1, api.Events.Raised.Count);
        Assert.Contains(e => e.SiteId == created.Text("id") && e.Change == "created", api.Events.Raised);
    }

    [TestMethod]
    public async Task Concurrent_posts_with_one_slug_create_exactly_one_site_AC24()
    {
        var api = await ContentApi.ReadyAsync();
        var slug = ContentApi.NewSlug();

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => api.PostAsync(ContentApi.NewOwner(), Json(slug: slug))));

        Assert.ContainsSingle(r => r.Status == HttpStatusCode.Created, responses);
        Assert.IsTrue(responses.Where(r => r.Status != HttpStatusCode.Created).All(r => r.ErrorCode == "slug_taken"));
    }
}

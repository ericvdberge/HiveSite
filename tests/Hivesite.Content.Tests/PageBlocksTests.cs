using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Tests;

/// <summary>GET and PUT /pages/{id}/blocks (API-004) over HTTP against PostgreSQL.</summary>
[TestClass]
public sealed class PageBlocksTests
{
    private static readonly string[] TwoVersions = ["\"2\"", "\"3\""];

    private const string Empty = """{"type":"doc","content":[]}""";
    private const string Hero = """{"type":"hero","attrs":{"title":"T"}}""";

    private static string Example(string name) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Examples", name));

    private static string Doc(params string[] blocks) => $$"""{"type":"doc","content":[{{string.Join(',', blocks)}}]}""";

    private static Task<ApiResponse> PutAsync(ContentApi api, string? owner, string id, string json, params (string Name, string Value)[] headers) =>
        api.SendAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, json, headers);

    private static Task<ApiResponse> GetBlocksAsync(ContentApi api, string? owner, string id) => api.GetAsync(owner, $"/pages/{id}/blocks");

    private static async Task<(ContentApi Api, string Owner, string SiteId, string PageId)> SetUpAsync()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        return (api, owner, siteId, (await api.CreatePageAsync(owner, siteId)).Text("id"));
    }

    private static int BlockEvents(ContentApi api, string pageId) => api.PageEvents.Pages.Count(e => e.PageId == pageId && e.Change == "blocks");

    private static ByteArrayContent Bytes(int length, string mediaType = "application/json")
    {
        var body = Encoding.UTF8.GetBytes(Empty.PadRight(length));
        var content = new ByteArrayContent(body);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mediaType);
        return content;
    }

    [TestMethod]
    public async Task A_page_without_blocks_has_the_empty_document_at_version_1_AC1()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await GetBlocksAsync(api, owner, id);

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual(Empty, response.Body.GetRawText());
        Assert.AreEqual("\"1\"", response.ETag);
    }

    [TestMethod]
    public async Task A_stored_document_is_read_back_with_its_version_AC1()
    {
        var (api, owner, _, id) = await SetUpAsync();
        await PutAsync(api, owner, id, Example("blocks-put-request.json"));

        var response = await GetBlocksAsync(api, owner, id);

        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(Example("blocks-get-response.json")), JsonNode.Parse(response.Body.GetRawText())));
        Assert.AreEqual("\"2\"", response.ETag);
    }

    [TestMethod]
    public async Task Without_credentials_the_answer_is_401_AC2()
    {
        var (api, _, _, id) = await SetUpAsync();

        foreach (var response in new[] { await GetBlocksAsync(api, null, id), await PutAsync(api, null, id, Empty) })
        {
            Assert.AreEqual(HttpStatusCode.Unauthorized, response.Status);
            Assert.AreEqual("unauthenticated", response.ErrorCode);
        }
    }

    [TestMethod]
    public async Task A_missing_foreign_or_malformed_page_is_404_and_nothing_is_stored_AC2()
    {
        var (api, owner, _, id) = await SetUpAsync();
        var events = api.PageEvents.Pages.Count;

        foreach (var pageId in new[] { Guid.CreateVersion7().ToString(), "not-a-uuid" })
        {
            foreach (var response in new[] { await GetBlocksAsync(api, owner, pageId), await PutAsync(api, owner, pageId, Doc(Hero)) })
            {
                Assert.AreEqual(HttpStatusCode.NotFound, response.Status);
                Assert.AreEqual("page_not_found", response.ErrorCode);
            }
        }
        var foreign = ContentApi.NewOwner();
        Assert.AreEqual("page_not_found", (await GetBlocksAsync(api, foreign, id)).ErrorCode);
        Assert.AreEqual("page_not_found", (await PutAsync(api, foreign, id, Doc(Hero))).ErrorCode);

        Assert.AreEqual(Empty, (await GetBlocksAsync(api, owner, id)).Body.GetRawText());
        Assert.AreEqual(events, api.PageEvents.Pages.Count);
    }

    [TestMethod]
    public async Task The_owner_of_another_site_cannot_write_this_page_AC24()
    {
        var (api, owner, _, id) = await SetUpAsync();
        var other = ContentApi.NewOwner();
        await api.CreateAsync(other);

        var response = await PutAsync(api, other, id, Example("blocks-put-request.json"));

        Assert.AreEqual(HttpStatusCode.NotFound, response.Status);
        Assert.AreEqual("page_not_found", response.ErrorCode);
        Assert.AreEqual("\"1\"", (await GetBlocksAsync(api, owner, id)).ETag);
    }

    [TestMethod]
    public async Task The_spec_example_is_stored_with_defaults_and_the_next_version_AC3()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var put = await PutAsync(api, owner, id, Example("blocks-put-request.json"));
        var get = await GetBlocksAsync(api, owner, id);

        Assert.AreEqual(HttpStatusCode.OK, put.Status);
        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(Example("blocks-get-response.json")), JsonNode.Parse(put.Body.GetRawText())));
        Assert.AreEqual("\"2\"", put.ETag);
        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(put.Body.GetRawText()), JsonNode.Parse(get.Body.GetRawText())));
        Assert.AreEqual(put.ETag, get.ETag);
    }

    [TestMethod]
    public async Task The_same_PUT_twice_changes_nothing_the_second_time_AC4()
    {
        var (api, owner, _, id) = await SetUpAsync();
        var first = await PutAsync(api, owner, id, Example("blocks-put-request.json"));
        var updatedAt = (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at");
        var events = BlockEvents(api, id);
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var second = await PutAsync(api, owner, id, Example("blocks-put-request.json"));
        var third = await PutAsync(api, owner, id, second.Body.GetRawText());

        foreach (var response in new[] { second, third })
        {
            Assert.AreEqual(HttpStatusCode.OK, response.Status);
            Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(first.Body.GetRawText()), JsonNode.Parse(response.Body.GetRawText())));
            Assert.AreEqual(first.ETag, response.ETag);
        }
        Assert.AreEqual(updatedAt, (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at"));
        Assert.AreEqual(events, BlockEvents(api, id));
    }

    [TestMethod]
    public async Task Clearing_an_empty_page_is_a_no_op_AC4()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await PutAsync(api, owner, id, Empty);

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual("\"1\"", response.ETag);
        Assert.AreEqual(0, BlockEvents(api, id));
    }

    [TestMethod]
    public async Task A_change_moves_updated_at_raises_one_event_and_touches_nothing_else_AC5()
    {
        var (api, owner, siteId, id) = await SetUpAsync();
        var second = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var pageBefore = (await api.GetAsync(owner, "/pages/" + id)).Body;
        var menuBefore = await api.MenuAsync(owner, siteId);
        var menuEvents = api.MenuEventsFor(siteId);
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        await PutAsync(api, owner, id, Doc(Hero));

        var pageAfter = (await api.GetAsync(owner, "/pages/" + id)).Body;
        Assert.IsTrue(DateTime.Parse(pageAfter.GetProperty("updated_at").GetString()!, CultureInfo.InvariantCulture) > DateTime.Parse(pageBefore.GetProperty("updated_at").GetString()!, CultureInfo.InvariantCulture));
        foreach (var property in pageBefore.EnumerateObject().Where(p => p.Name != "updated_at"))
        {
            Assert.AreEqual(property.Value.GetRawText(), pageAfter.GetProperty(property.Name).GetRawText(), property.Name);
        }
        Assert.IsFalse(pageAfter.TryGetProperty("blocks", out _) || pageAfter.TryGetProperty("content", out _));
        CollectionAssert.AreEqual(menuBefore, await api.MenuAsync(owner, siteId));
        Assert.AreEqual(menuEvents, api.MenuEventsFor(siteId));
        var raised = api.PageEvents.Pages.Where(e => e.PageId == id && e.Change == "blocks").ToList();
        Assert.AreEqual(1, raised.Count);
        Assert.AreEqual(siteId, raised[0].SiteId);
        Assert.AreEqual(0, BlockEvents(api, second));
    }

    [TestMethod]
    public async Task An_empty_content_clears_the_blocks_forty_pass_and_forty_one_do_not_AC6()
    {
        var (api, owner, _, id) = await SetUpAsync();

        Assert.AreEqual(HttpStatusCode.OK, (await PutAsync(api, owner, id, Doc(Enumerable.Repeat(Hero, 40).ToArray()))).Status);
        var tooMany = await PutAsync(api, owner, id, Doc(Enumerable.Repeat(Hero, 41).ToArray()));
        Assert.AreEqual(HttpStatusCode.BadRequest, tooMany.Status);
        Assert.AreEqual("too_many_blocks", tooMany.ErrorCode);
        Assert.AreEqual(40, (await GetBlocksAsync(api, owner, id)).Node("content").GetArrayLength());

        var cleared = await PutAsync(api, owner, id, Empty);

        Assert.AreEqual(HttpStatusCode.OK, cleared.Status);
        Assert.AreEqual(Empty, (await GetBlocksAsync(api, owner, id)).Body.GetRawText());
        Assert.AreEqual("\"3\"", cleared.ETag);
    }

    [TestMethod]
    [DataRow("")]
    [DataRow("not json")]
    [DataRow("[]")]
    [DataRow("5")]
    [DataRow("""{"type":"page","content":[]}""")]
    [DataRow("""{"type":"doc"}""")]
    [DataRow("""{"type":"doc","content":[5]}""")]
    [DataRow("""{"type":"doc","content":[{"attrs":{}}]}""")]
    [DataRow("""{"type":"doc","content":[],"extra":true}""")]
    [DataRow("""{"type":"doc","type":"doc","content":[]}""")]
    public async Task A_body_of_the_wrong_shape_is_invalid_request_AC7(string body)
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
    }

    [TestMethod]
    [DataRow("*")]
    [DataRow("\"1\", \"2\"")]
    public async Task An_If_Match_of_star_or_a_list_is_invalid_request_AC7(string ifMatch)
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await PutAsync(api, owner, id, Doc(Hero), ("If-Match", ifMatch));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual("If-Match", response.ErrorField);
    }

    [TestMethod]
    public async Task An_unknown_block_type_names_its_pointer_AC8()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await PutAsync(api, owner, id, Doc(Hero, Hero, Hero, """{"type":"columns"}"""));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("unknown_block_type", response.ErrorCode);
        Assert.AreEqual("/content/3/type", response.ErrorField);
    }

    [TestMethod]
    public async Task A_block_that_breaks_its_schema_is_invalid_block_in_the_error_shape_AC9()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await PutAsync(api, owner, id, Doc($$$"""{"type":"hero","attrs":{"title":"{{{new string('a', 81)}}}"}}"""));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_block", response.ErrorCode);
        Assert.AreEqual("/content/0/attrs/title", response.ErrorField);
        Assert.AreEqual("/content/0/attrs/title: must be at most 80 characters", response.Text("error", "message"));
    }

    [TestMethod]
    public async Task Trimming_and_defaults_apply_to_the_stored_document_AC11()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"  Hello  "}}"""));

        Assert.AreEqual("Hello", response.Node("content")[0].GetProperty("attrs").GetProperty("title").GetString());
        Assert.AreEqual("", response.Node("content")[0].GetProperty("attrs").GetProperty("subtitle").GetString());
        Assert.AreEqual("invalid_block", (await PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"   "}}"""))).ErrorCode);
    }

    [TestMethod]
    public async Task The_first_failure_follows_the_documented_order_AC13()
    {
        var (api, owner, _, id) = await SetUpAsync();
        var bad = Doc(Enumerable.Repeat("""{"type":"hero","attrs":{}}""", 41).ToArray());

        var stale = await PutAsync(api, owner, id, "not json", ("If-Match", "\"9\""));
        var count = await PutAsync(api, owner, id, bad, ("If-Match", "\"1\""));
        var wrongType = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, Bytes(262_145, "text/plain"));
        var wrongMedia = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, new StringContent("x", Encoding.UTF8, "text/plain"), ("If-Match", "*"));
        var star = await PutAsync(api, owner, id, "not json", ("If-Match", "*"));

        Assert.AreEqual("precondition_failed", stale.ErrorCode);
        Assert.AreEqual("too_many_blocks", count.ErrorCode);
        Assert.AreEqual("request_too_large", wrongType.ErrorCode);
        Assert.AreEqual("unsupported_media_type", wrongMedia.ErrorCode);
        Assert.AreEqual("invalid_request", star.ErrorCode);
    }

    [TestMethod]
    public async Task A_failing_block_stores_nothing_not_even_the_blocks_before_it_AC14()
    {
        var (api, owner, _, id) = await SetUpAsync();
        await PutAsync(api, owner, id, Doc(Hero));
        var before = await GetBlocksAsync(api, owner, id);
        var updatedAt = (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at");
        var events = BlockEvents(api, id);
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"Changed"}}""", """{"type":"hero","attrs":{}}"""));

        Assert.AreEqual("invalid_block", response.ErrorCode);
        var after = await GetBlocksAsync(api, owner, id);
        Assert.AreEqual(before.Body.GetRawText(), after.Body.GetRawText());
        Assert.AreEqual(before.ETag, after.ETag);
        Assert.AreEqual(updatedAt, (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at"));
        Assert.AreEqual(events, BlockEvents(api, id));
    }

    [TestMethod]
    [DataRow("""{"type":"image","attrs":{"image":{"url":"https://","alt":""}}}""", "/content/1/attrs/image/url")]
    [DataRow("""{"type":"contact_form","attrs":{"action_url":"https://a.nl/s","fields":[{"name":"a","label":"A","kind":"text"},{"name":"a","label":"B","kind":"text"}]}}""", "/content/1/attrs/fields/1/name")]
    [DataRow("""{"type":"embed","attrs":{"provider":"youtube","url":"https://youtube.com.evil.example/x","title":"T"}}""", "/content/1/attrs/url")]
    [DataRow("""{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"bold"},{"type":"bold"}]}]}]}""", "/content/1/content/0/content/0/marks/1")]
    public async Task A_block_that_breaks_a_rule_is_invalid_block_and_nothing_changes_AC11(string block, string field)
    {
        var (api, owner, _, id) = await SetUpAsync();
        await PutAsync(api, owner, id, Doc(Hero));
        var before = await GetBlocksAsync(api, owner, id);
        var updatedAt = (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at");
        var events = BlockEvents(api, id);
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await PutAsync(api, owner, id, Doc(Hero, block));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_block", response.ErrorCode);
        Assert.AreEqual(field, response.ErrorField);
        Assert.StartsWith(field + ": ", response.Text("error", "message"));
        var after = await GetBlocksAsync(api, owner, id);
        Assert.AreEqual(before.Body.GetRawText(), after.Body.GetRawText());
        Assert.AreEqual(before.ETag, after.ETag);
        Assert.AreEqual(updatedAt, (await api.GetAsync(owner, "/pages/" + id)).Text("updated_at"));
        Assert.AreEqual(events, BlockEvents(api, id));
    }

    [TestMethod]
    public async Task Html_and_the_extra_link_attributes_are_stored_as_sent_AC8()
    {
        var (api, owner, _, id) = await SetUpAsync();
        var rich = """{"type":"rich_text","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"<script>"}]},{"type":"paragraph","content":[{"type":"text","text":"<b>x</b>","marks":[{"type":"link","attrs":{"href":"/","target":"_blank","rel":"nofollow","class":"c"}}]}]},{"type":"orderedList","attrs":{"start":2,"type":"a"},"content":[{"type":"listItem","content":[{"type":"paragraph"}]}]}]}""";

        var response = await PutAsync(api, owner, id, Doc(rich, """{"type":"hero","attrs":{"title":"<i>t</i>"}}"""));

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        var stored = (await GetBlocksAsync(api, owner, id)).Body;
        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(rich), JsonNode.Parse(stored.GetProperty("content")[0].GetRawText())));
        Assert.AreEqual("<i>t</i>", stored.GetProperty("content")[1].GetProperty("attrs").GetProperty("title").GetString());
    }

    [TestMethod]
    public async Task A_body_over_256_KB_is_413_even_if_it_is_not_JSON_and_exactly_256_KB_passes_AC15()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var tooLarge = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, Bytes(262_145));
        var notJson = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, new StringContent(new string('x', 262_145), Encoding.UTF8, "application/json"));
        var exact = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, Bytes(262_144));

        Assert.AreEqual(HttpStatusCode.RequestEntityTooLarge, tooLarge.Status);
        Assert.AreEqual("request_too_large", tooLarge.ErrorCode);
        Assert.AreEqual("request_too_large", notJson.ErrorCode);
        Assert.AreEqual(HttpStatusCode.OK, exact.Status);
    }

    [TestMethod]
    [DataRow("text/plain")]
    [DataRow("application/json-patch+json")]
    public async Task Another_media_type_is_415_AC15(string mediaType)
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, new StringContent(Doc(Hero), Encoding.UTF8, mediaType));

        Assert.AreEqual(HttpStatusCode.UnsupportedMediaType, response.Status);
        Assert.AreEqual("unsupported_media_type", response.ErrorCode);
    }

    [TestMethod]
    public async Task A_charset_does_not_change_the_media_type_AC15()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var response = await api.SendContentAsync(HttpMethod.Put, $"/pages/{id}/blocks", owner, new StringContent(Doc(Hero), Encoding.UTF8, "application/json"));

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
    }

    [TestMethod]
    public async Task If_Match_must_be_the_current_strong_ETag_and_none_means_last_write_wins_AC16()
    {
        var (api, owner, _, id) = await SetUpAsync();

        var current = await PutAsync(api, owner, id, Doc(Hero), ("If-Match", "\"1\""));
        Assert.AreEqual(HttpStatusCode.OK, current.Status);
        Assert.AreEqual("\"2\"", current.ETag);

        foreach (var stale in new[] { "\"1\"", "W/\"2\"", "2", "\"x\"", "\"-1\"" })
        {
            var response = await PutAsync(api, owner, id, Doc(Hero, Hero), ("If-Match", stale));
            Assert.AreEqual(HttpStatusCode.PreconditionFailed, response.Status, stale);
            Assert.AreEqual("precondition_failed", response.ErrorCode);
        }
        Assert.AreEqual("\"2\"", (await GetBlocksAsync(api, owner, id)).ETag);
        Assert.AreEqual(1, (await GetBlocksAsync(api, owner, id)).Node("content").GetArrayLength());

        var overwrite = await PutAsync(api, owner, id, Doc(Hero, Hero));
        Assert.AreEqual(HttpStatusCode.OK, overwrite.Status);
        Assert.AreEqual("\"3\"", overwrite.ETag);
    }

    [TestMethod]
    public async Task Two_writes_with_the_same_If_Match_let_exactly_one_win_AC17()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        for (var round = 0; round < 5; round++)
        {
            var id = (await api.CreatePageAsync(owner, siteId)).Text("id");
            if (round % 2 == 1)
            {
                await PutAsync(api, owner, id, Doc(Hero));   // a stored row, not the first save
            }
            var version = (await GetBlocksAsync(api, owner, id)).ETag!;

            var results = await Task.WhenAll(
                PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"A"}}"""), ("If-Match", version)),
                PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"B"}}"""), ("If-Match", version)));

            CollectionAssert.AreEquivalent(new[] { HttpStatusCode.OK, HttpStatusCode.PreconditionFailed }, results.Select(r => r.Status).ToArray());
            Assert.AreEqual($"\"{int.Parse(version.Trim('"'), CultureInfo.InvariantCulture) + 1}\"", (await GetBlocksAsync(api, owner, id)).ETag);
            Assert.AreEqual(1, api.PageEvents.Pages.Count(e => e.PageId == id && e.Change == "blocks") - (round % 2));
        }
    }

    [TestMethod]
    public async Task Two_writes_without_If_Match_both_win_and_the_ETag_is_the_stored_version_AC16()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        for (var round = 0; round < 5; round++)
        {
            var id = (await api.CreatePageAsync(owner, siteId)).Text("id");   // a fresh page: both writes race for the first row

            var results = await Task.WhenAll(
                PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"A"}}""")),
                PutAsync(api, owner, id, Doc("""{"type":"hero","attrs":{"title":"B"}}""")));

            Assert.IsTrue(results.All(r => r.Status == HttpStatusCode.OK), string.Join(',', results.Select(r => r.Status)));
            CollectionAssert.AreEquivalent(TwoVersions, results.Select(r => r.ETag).ToArray());
            var stored = await GetBlocksAsync(api, owner, id);
            Assert.AreEqual("\"3\"", stored.ETag);
            var last = results.Single(r => r.ETag == "\"3\"");
            Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(last.Body.GetRawText()), JsonNode.Parse(stored.Body.GetRawText())));
        }
    }

    [TestMethod]
    public async Task Deleting_the_page_deletes_its_blocks_AC1()
    {
        var (api, owner, _, id) = await SetUpAsync();
        await PutAsync(api, owner, id, Doc(Hero));

        var deleted = await api.SendAsync(HttpMethod.Delete, "/pages/" + id, owner);

        Assert.AreEqual(HttpStatusCode.NoContent, deleted.Status);
        Assert.AreEqual(HttpStatusCode.NotFound, (await GetBlocksAsync(api, owner, id)).Status);
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Hivesite.Content.Infrastructure.ContentDbContext>();
        Assert.IsFalse(await db.PageBlocks.AnyAsync(b => b.PageId == Guid.Parse(id)));
    }
}

using System.Globalization;
using System.Net;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class UpdatePageTests
{
    private static Task<ApiResponse> PatchAsync(ContentApi api, string? owner, string id, string json) =>
        api.SendAsync(HttpMethod.Patch, "/pages/" + id, owner, json);

    private static async Task<(ContentApi Api, string Owner, string SiteId, ApiResponse Page)> SetUpAsync()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        return (api, owner, siteId, await api.CreatePageAsync(owner, siteId));
    }

    [TestMethod]
    public async Task The_owner_reads_a_page_in_any_case_AC14()
    {
        var (api, owner, _, page) = await SetUpAsync();
        var id = page.Text("id");

        var lower = await api.GetAsync(owner, "/pages/" + id);
        var upper = await api.GetAsync(owner, "/pages/" + id.ToUpperInvariant());

        Assert.AreEqual(HttpStatusCode.OK, lower.Status);
        Assert.AreEqual(page.Body.GetRawText(), lower.Body.GetRawText());
        Assert.AreEqual(id, upper.Text("id"));
    }

    [TestMethod]
    [DataRow("missing")]
    [DataRow("other")]
    [DataRow("abc")]
    public async Task Unknown_foreign_and_malformed_page_ids_give_one_identical_404_AC15(string kind)
    {
        var (api, owner, _, page) = await SetUpAsync();
        var id = kind switch { "missing" => Guid.CreateVersion7().ToString(), "other" => page.Text("id"), _ => "abc" };
        var stranger = ContentApi.NewOwner();
        var baseline = await api.GetAsync(stranger, $"/pages/{Guid.CreateVersion7()}");

        var get = await api.GetAsync(stranger, "/pages/" + id);
        var patch = await PatchAsync(api, stranger, id, """{"title":"x"}""");
        var delete = await api.SendAsync(HttpMethod.Delete, "/pages/" + id, stranger);

        foreach (var r in new[] { get, patch, delete })
        {
            Assert.AreEqual(HttpStatusCode.NotFound, r.Status);
            Assert.AreEqual("page_not_found", r.ErrorCode);
            Assert.IsNull(r.ErrorField);
            Assert.AreEqual(baseline.Body.GetRawText(), r.Body.GetRawText());
        }
        Assert.AreEqual(HttpStatusCode.OK, (await api.GetAsync(owner, "/pages/" + page.Text("id"))).Status);
    }

    [TestMethod]
    public async Task A_patch_changes_title_and_slug_and_moves_updated_at_AC16()
    {
        var (api, owner, _, page) = await SetUpAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await PatchAsync(api, owner, page.Text("id"), """{"title":" Selected work ","slug":"selected-work"}""");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual("Selected work", response.Text("title"));
        Assert.AreEqual("selected-work", response.Text("slug"));
        Assert.AreEqual(page.Node("menu_order").GetInt32(), response.Node("menu_order").GetInt32());
        Assert.AreEqual(page.Text("created_at"), response.Text("created_at"));
        Assert.IsTrue(DateTime.Parse(response.Text("updated_at"), CultureInfo.InvariantCulture) > DateTime.Parse(page.Text("updated_at"), CultureInfo.InvariantCulture));
        var read = await api.GetAsync(owner, "/pages/" + page.Text("id"));
        Assert.AreEqual(response.Body.GetRawText(), read.Body.GetRawText());
    }

    [TestMethod]
    public async Task A_patch_with_one_field_keeps_the_other_AC16()
    {
        var (api, owner, _, page) = await SetUpAsync();

        var response = await PatchAsync(api, owner, page.Text("id"), """{"title":"New"}""");

        Assert.AreEqual("New", response.Text("title"));
        Assert.AreEqual(page.Text("slug"), response.Text("slug"));
    }

    [TestMethod]
    public async Task A_patch_that_changes_nothing_is_a_no_op_AC17()
    {
        var (api, owner, _, page) = await SetUpAsync();
        var raised = api.PageEvents.Pages.Count;
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        foreach (var body in new[] { "{}", $$"""{"title":"Page","slug":"{{page.Text("slug")}}"}""", """{"title":null}""" })
        {
            var response = await PatchAsync(api, owner, page.Text("id"), body);

            Assert.AreEqual(HttpStatusCode.OK, response.Status);
            Assert.AreEqual(page.Body.GetRawText(), response.Body.GetRawText());
        }
        Assert.AreEqual(raised, api.PageEvents.Pages.Count);
    }

    [TestMethod]
    [DataRow("""{"menu_order":1}""")]
    [DataRow("""{"id":"x"}""")]
    [DataRow("""{"site_id":"x"}""")]
    [DataRow("""{"created_at":"2026-01-01T00:00:00Z"}""")]
    [DataRow("""{"updated_at":"2026-01-01T00:00:00Z"}""")]
    [DataRow("""{"extra":1}""")]
    [DataRow("""{"title":1}""")]
    [DataRow("""{"title":"A","slug":"Upper"}""")]
    [DataRow("""not json""")]
    public async Task A_bad_patch_is_refused_and_stores_nothing_AC18(string body)
    {
        var (api, owner, _, page) = await SetUpAsync();

        var response = await PatchAsync(api, owner, page.Text("id"), body);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        var read = await api.GetAsync(owner, "/pages/" + page.Text("id"));
        Assert.AreEqual(page.Body.GetRawText(), read.Body.GetRawText());
    }

    [TestMethod]
    public async Task A_slug_of_another_page_is_refused_AC19()
    {
        var (api, owner, siteId, page) = await SetUpAsync();
        var other = await api.CreatePageAsync(owner, siteId, "other");

        var response = await PatchAsync(api, owner, page.Text("id"), """{"slug":"other"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("slug_taken", response.ErrorCode);
        Assert.AreEqual(other.Text("slug"), (await api.GetAsync(owner, "/pages/" + other.Text("id"))).Text("slug"));
    }

    [TestMethod]
    public async Task A_deleted_page_is_gone_AC20()
    {
        var (api, owner, _, page) = await SetUpAsync();
        var id = page.Text("id");

        var delete = await api.SendAsync(HttpMethod.Delete, "/pages/" + id, owner);
        var get = await api.GetAsync(owner, "/pages/" + id);
        var again = await api.SendAsync(HttpMethod.Delete, "/pages/" + id, owner);

        Assert.AreEqual(HttpStatusCode.NoContent, delete.Status);
        Assert.AreEqual("", await delete.Raw.Content.ReadAsStringAsync());
        Assert.AreEqual("page_not_found", get.ErrorCode);
        Assert.AreEqual(HttpStatusCode.NotFound, again.Status);
        Assert.AreEqual("page_not_found", again.ErrorCode);
    }

    [TestMethod]
    public async Task Deleting_a_page_closes_the_gap_and_leaves_updated_at_AC21()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var pages = new List<ApiResponse>();
        for (var i = 0; i < 4; i++)
        {
            pages.Add(await api.CreatePageAsync(owner, siteId));
        }
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        await api.SendAsync(HttpMethod.Delete, "/pages/" + pages[1].Text("id"), owner);

        var list = await api.GetAsync(owner, $"/sites/{siteId}/pages");
        var items = list.Node("items").EnumerateArray().ToList();
        List<int> kept = [0, 2, 3];
        CollectionAssert.AreEqual(new List<int> { 0, 1, 2 }, items.Select(i => i.GetProperty("menu_order").GetInt32()).ToList());
        CollectionAssert.AreEqual(kept.Select(i => pages[i].Text("id")).ToList(), items.Select(i => i.GetProperty("id").GetString()!).ToList());
        CollectionAssert.AreEqual(kept.Select(i => pages[i].Text("updated_at")).ToList(), items.Select(i => i.GetProperty("updated_at").GetString()!).ToList());
    }

    [TestMethod]
    public async Task The_last_page_can_be_deleted_AC22()
    {
        var (api, owner, siteId, page) = await SetUpAsync();

        var delete = await api.SendAsync(HttpMethod.Delete, "/pages/" + page.Text("id"), owner);

        Assert.AreEqual(HttpStatusCode.NoContent, delete.Status);
        Assert.IsEmpty(await api.MenuAsync(owner, siteId));
    }
}

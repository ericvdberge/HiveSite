using System.Net;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class MenuTests
{
    private static async Task<(ContentApi Api, string Owner, string SiteId, List<ApiResponse> Pages)> SetUpAsync(int pages = 3)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var created = new List<ApiResponse>();
        for (var i = 0; i < pages; i++)
        {
            created.Add(await api.CreatePageAsync(owner, siteId));
        }
        return (api, owner, siteId, created);
    }

    [TestMethod]
    public async Task A_permutation_sets_the_menu_order_AC23()
    {
        var (api, owner, siteId, pages) = await SetUpAsync();
        var order = new[] { pages[2].Text("id"), pages[0].Text("id"), pages[1].Text("id") };

        var response = await api.PutMenuAsync(owner, siteId, order);

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual(siteId, response.Text("site_id"));
        CollectionAssert.AreEqual(order, response.Node("page_ids").EnumerateArray().Select(i => i.GetString()).ToList());
        var list = await api.GetAsync(owner, $"/sites/{siteId}/pages");
        var items = list.Node("items").EnumerateArray().ToList();
        CollectionAssert.AreEqual(order, items.Select(i => i.GetProperty("id").GetString()).ToList());
        CollectionAssert.AreEqual(new List<int> { 0, 1, 2 }, items.Select(i => i.GetProperty("menu_order").GetInt32()).ToList());
    }

    [TestMethod]
    public async Task The_same_list_twice_gives_the_same_result_AC24()
    {
        var (api, owner, siteId, pages) = await SetUpAsync();
        var order = new[] { pages[1].Text("id"), pages[2].Text("id"), pages[0].Text("id") };

        var first = await api.PutMenuAsync(owner, siteId, order);
        var second = await api.PutMenuAsync(owner, siteId, order);

        Assert.AreEqual(HttpStatusCode.OK, second.Status);
        Assert.AreEqual(first.Body.GetRawText(), second.Body.GetRawText());
        CollectionAssert.AreEqual(order, await api.MenuAsync(owner, siteId));
    }

    [TestMethod]
    public async Task A_changing_menu_leaves_updated_at_of_the_pages_AC25()
    {
        var (api, owner, siteId, pages) = await SetUpAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var order = new[] { pages[2].Text("id"), pages[1].Text("id"), pages[0].Text("id") };

        var response = await api.PutMenuAsync(owner, siteId, order);

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        CollectionAssert.AreEqual(order, await api.MenuAsync(owner, siteId));
        foreach (var page in pages)
        {
            var read = await api.GetAsync(owner, "/pages/" + page.Text("id"));
            Assert.AreEqual(page.Text("updated_at"), read.Text("updated_at"));
        }
    }

    [TestMethod]
    [DataRow("not json")]
    [DataRow("{}")]
    [DataRow("""{"page_ids":null}""")]
    [DataRow("""{"page_ids":"x"}""")]
    [DataRow("""{"page_ids":[1,2]}""")]
    [DataRow("""{"page_ids":[],"extra":1}""")]
    [DataRow("""{"page_ids":["abc"]}""")]
    public async Task A_broken_menu_body_is_refused_AC26(string body)
    {
        var (api, owner, siteId, _) = await SetUpAsync(1);

        var response = await api.SendAsync(HttpMethod.Put, $"/sites/{siteId}/menu", owner, body);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
    }

    [TestMethod]
    public async Task A_repeated_id_is_refused_AC26()
    {
        var (api, owner, siteId, pages) = await SetUpAsync(2);
        var id = pages[0].Text("id");

        var response = await api.PutMenuAsync(owner, siteId, id, id);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual("/page_ids", response.ErrorField);
    }

    [TestMethod]
    public async Task An_unknown_foreign_or_missing_page_is_a_mismatch_and_changes_nothing_AC27()
    {
        var (api, owner, siteId, pages) = await SetUpAsync();
        var otherSite = (await api.CreateAsync(owner)).Text("id");
        var foreign = (await api.CreatePageAsync(owner, otherSite)).Text("id");
        var before = await api.MenuAsync(owner, siteId);
        var ids = pages.Select(p => p.Text("id")).ToArray();

        var attempts = new[]
        {
            new[] { ids[1], ids[0], Guid.CreateVersion7().ToString() },
            new[] { ids[1], ids[0], foreign },
            new[] { ids[1], ids[0] },
            new[] { ids[1], ids[0], ids[2], foreign },
        };

        foreach (var attempt in attempts)
        {
            var response = await api.PutMenuAsync(owner, siteId, attempt);

            Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
            Assert.AreEqual("menu_mismatch", response.ErrorCode);
        }
        CollectionAssert.AreEqual(before, await api.MenuAsync(owner, siteId));
    }

    [TestMethod]
    public async Task An_empty_list_fits_only_a_site_without_pages_AC28()
    {
        var empty = await SetUpAsync(0);
        var full = await SetUpAsync(1);

        var ok = await empty.Api.PutMenuAsync(empty.Owner, empty.SiteId);
        var mismatch = await full.Api.PutMenuAsync(full.Owner, full.SiteId);

        Assert.AreEqual(HttpStatusCode.OK, ok.Status);
        Assert.IsEmpty(ok.Node("page_ids").EnumerateArray());
        Assert.AreEqual(HttpStatusCode.BadRequest, mismatch.Status);
        Assert.AreEqual("menu_mismatch", mismatch.ErrorCode);
    }
}

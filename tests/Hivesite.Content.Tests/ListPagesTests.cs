using System.Net;
using System.Text.Json;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class ListPagesTests
{
    private static List<string> Ids(ApiResponse page) => page.Node("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()!).ToList();

    [TestMethod]
    public async Task Lists_only_the_pages_of_the_site_by_menu_order_AC10()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var otherSite = (await api.CreateAsync(owner)).Text("id");
        var first = (await api.CreatePageAsync(owner, siteId)).Text("id");
        await api.CreatePageAsync(owner, otherSite);
        var second = (await api.CreatePageAsync(owner, siteId)).Text("id");

        var page = await api.GetAsync(owner, $"/sites/{siteId}/pages");

        Assert.AreEqual(HttpStatusCode.OK, page.Status);
        CollectionAssert.AreEqual(new[] { first, second }, Ids(page));
        Assert.AreEqual(JsonValueKind.Null, page.Node("next_cursor").ValueKind);
    }

    [TestMethod]
    public async Task A_site_without_pages_gives_an_empty_list_AC10()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var page = await api.GetAsync(owner, $"/sites/{siteId}/pages");

        Assert.AreEqual(HttpStatusCode.OK, page.Status);
        Assert.IsEmpty(page.Node("items").EnumerateArray());
        Assert.AreEqual(JsonValueKind.Null, page.Node("next_cursor").ValueKind);
    }

    [TestMethod]
    public async Task Paging_shows_every_page_once_in_order_AC11()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var created = new List<string>();
        for (var i = 0; i < 5; i++)
        {
            created.Add((await api.CreatePageAsync(owner, siteId)).Text("id"));
        }

        var seen = new List<string>();
        var path = $"/sites/{siteId}/pages?limit=2";
        var pages = 0;
        while (path is not null)
        {
            var page = await api.GetAsync(owner, path);
            seen.AddRange(Ids(page));
            var next = page.Node("next_cursor");
            path = next.ValueKind == JsonValueKind.Null ? null : $"/sites/{siteId}/pages?limit=2&cursor={Uri.EscapeDataString(next.GetString()!)}";
            pages++;
        }

        CollectionAssert.AreEqual(created, seen);
        Assert.AreEqual(3, pages);
    }

    [TestMethod]
    [DataRow("1")]
    [DataRow("100")]
    public async Task Limits_1_and_100_are_accepted_AC11(string limit)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await api.GetAsync(owner, $"/sites/{siteId}/pages?limit={limit}");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
    }

    [TestMethod]
    [DataRow("0")]
    [DataRow("101")]
    [DataRow("abc")]
    [DataRow("")]
    public async Task A_bad_limit_is_refused_AC12(string limit)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await api.GetAsync(owner, $"/sites/{siteId}/pages?limit={limit}");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        if (limit is "0" or "101")
        {
            Assert.AreEqual("limit", response.ErrorField);
        }
    }

    [TestMethod]
    public async Task A_garbage_cursor_or_one_of_another_site_is_refused_AC13()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var otherSite = (await api.CreateAsync(owner)).Text("id");
        await api.CreatePageAsync(owner, siteId);
        var foreignPage = (await api.CreatePageAsync(owner, otherSite)).Text("id");

        foreach (var cursor in new[] { "garbage", Guid.CreateVersion7().ToString(), foreignPage })
        {
            var response = await api.GetAsync(owner, $"/sites/{siteId}/pages?cursor={cursor}");

            Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
            Assert.AreEqual("invalid_cursor", response.ErrorCode);
            Assert.AreEqual("cursor", response.ErrorField);
        }
    }
}

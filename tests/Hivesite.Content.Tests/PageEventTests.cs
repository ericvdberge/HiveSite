using System.Net;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class PageEventTests
{
    [TestMethod]
    public async Task Create_update_and_delete_raise_one_page_event_each_AC29()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var id = (await api.CreatePageAsync(owner, siteId)).Text("id");
        await api.SendAsync(HttpMethod.Patch, "/pages/" + id, owner, """{"title":"New"}""");
        await api.SendAsync(HttpMethod.Patch, "/pages/" + id, owner, """{"title":"New"}""");
        await api.SendAsync(HttpMethod.Patch, "/pages/" + id, owner, "{}");
        await api.SendAsync(HttpMethod.Delete, "/pages/" + id, owner);

        var raised = api.PageEvents.Pages.Where(e => e.PageId == id).ToList();
        CollectionAssert.AreEqual(new List<string> { "created", "updated", "deleted" }, raised.Select(e => e.Change).ToList());
        Assert.IsTrue(raised.All(e => e.SiteId == siteId));
    }

    [TestMethod]
    public async Task Failures_raise_nothing_AC29()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var id = (await api.CreatePageAsync(owner, siteId, "taken")).Text("id");
        var other = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var pages = api.PageEvents.Pages.Count;
        var menus = api.PageEvents.Menus.Count;

        await api.SendAsync(HttpMethod.Post, $"/sites/{siteId}/pages", owner, """{"title":"A","slug":"taken"}""");
        await api.SendAsync(HttpMethod.Post, $"/sites/{siteId}/pages", owner, """{"title":"A","slug":"assets"}""");
        await api.SendAsync(HttpMethod.Post, $"/sites/{siteId}/pages", owner, "{}");
        await api.SendAsync(HttpMethod.Patch, "/pages/" + other, owner, """{"slug":"taken"}""");
        await api.SendAsync(HttpMethod.Delete, "/pages/" + Guid.CreateVersion7(), owner);
        await api.SendAsync(HttpMethod.Delete, "/pages/" + id, ContentApi.NewOwner());
        await api.PutMenuAsync(owner, siteId, id);

        Assert.AreEqual(pages, api.PageEvents.Pages.Count);
        Assert.AreEqual(menus, api.PageEvents.Menus.Count);
    }

    [TestMethod]
    public async Task Create_delete_and_a_changing_PUT_raise_one_menu_event_each_AC30()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var a = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var b = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var c = (await api.CreatePageAsync(owner, siteId)).Text("id");
        Assert.AreEqual(3, api.MenuEventsFor(siteId));

        var same = await api.PutMenuAsync(owner, siteId, a, b, c);
        Assert.AreEqual(HttpStatusCode.OK, same.Status);
        Assert.AreEqual(3, api.MenuEventsFor(siteId));

        await api.PutMenuAsync(owner, siteId, c, a, b);
        await api.PutMenuAsync(owner, siteId, c, a, b);
        Assert.AreEqual(4, api.MenuEventsFor(siteId));
        CollectionAssert.AreEqual(new[] { c, a, b }, api.PageEvents.Menus.Last(m => m.SiteId == siteId).PageIds.ToList());

        await api.SendAsync(HttpMethod.Delete, "/pages/" + a, owner);
        Assert.AreEqual(5, api.MenuEventsFor(siteId));
        CollectionAssert.AreEqual(new[] { c, b }, api.PageEvents.Menus.Last(m => m.SiteId == siteId).PageIds.ToList());
    }
}

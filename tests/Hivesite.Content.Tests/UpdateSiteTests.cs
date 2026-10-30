using System.Net;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class UpdateSiteTests
{
    [TestMethod]
    public async Task Patching_the_name_leaves_the_rest_and_moves_updated_at_AC18()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"nl","description":"Keep"}""");
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, created.Text("id"), """{"name":"  Renamed "}""");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual("Renamed", response.Text("name"));
        Assert.AreEqual(created.Text("slug"), response.Text("slug"));
        Assert.AreEqual("nl", response.Text("settings", "language"));
        Assert.AreEqual("Keep", response.Text("settings", "description"));
        Assert.AreEqual(created.Text("created_at"), response.Text("created_at"));
        Assert.IsTrue(DateTime.Parse(response.Text("updated_at"), System.Globalization.CultureInfo.InvariantCulture) > DateTime.Parse(created.Text("updated_at"), System.Globalization.CultureInfo.InvariantCulture));
        var read = await api.GetAsync(owner, "/sites/" + created.Text("id"));
        Assert.AreEqual(response.Body.GetRawText(), read.Body.GetRawText());
    }

    [TestMethod]
    public async Task Settings_merge_one_level_deep_and_the_slug_can_change_AC19()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"nl","description":"Old"}""");
        var slug = ContentApi.NewSlug();

        var response = await api.PatchAsync(owner, created.Text("id"), "{\"slug\":\"" + slug + "\",\"settings\":{\"description\":\"New\"}}");

        Assert.AreEqual("nl", response.Text("settings", "language"));
        Assert.AreEqual("New", response.Text("settings", "description"));
        Assert.AreEqual(slug, response.Text("slug"));
    }

    [TestMethod]
    [DataRow("{}")]
    [DataRow("""{"settings":{}}""")]
    [DataRow("""{"name":"Site","settings":{"language":"en","description":""}}""")]
    public async Task A_patch_that_changes_nothing_is_a_no_op_AC20(string body)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner);
        var raised = api.Events.Raised.Count;
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, created.Text("id"), body);

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual(created.Body.GetRawText(), response.Body.GetRawText());
        Assert.AreEqual(raised, api.Events.Raised.Count);
    }

    [TestMethod]
    [DataRow("""{"name":5}""", "/name")]
    [DataRow("""{"theme":"x"}""", "/theme")]
    [DataRow("""{"settings":{"extra":1}}""", "/settings/extra")]
    [DataRow("""{"slug":"AB"}""", "/slug")]
    public async Task Invalid_input_is_refused_and_nothing_is_stored_AC21(string body, string field)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner);

        var response = await api.PatchAsync(owner, created.Text("id"), body);
        var read = await api.GetAsync(owner, "/sites/" + created.Text("id"));

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual(field, response.ErrorField);
        Assert.AreEqual(created.Body.GetRawText(), read.Body.GetRawText());
    }

    [TestMethod]
    public async Task A_taken_slug_is_refused_but_ones_own_slug_is_not_a_conflict_AC22()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var site = await api.CreateAsync(owner);
        var foreign = await api.CreateAsync(ContentApi.NewOwner());

        var taken = await api.PatchAsync(owner, site.Text("id"), $$"""{"slug":"{{foreign.Text("slug")}}"}""");
        var own = await api.PatchAsync(owner, site.Text("id"), $$"""{"slug":"{{site.Text("slug")}}"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, taken.Status);
        Assert.AreEqual("slug_taken", taken.ErrorCode);
        Assert.AreEqual("/slug", taken.ErrorField);
        Assert.AreEqual(HttpStatusCode.OK, own.Status);
    }

    [TestMethod]
    public async Task A_changing_patch_raises_updated_once_AC23()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var id = (await api.CreateAsync(owner)).Text("id");

        await api.PatchAsync(owner, id, """{"name":"Changed"}""");
        await api.PatchAsync(owner, id, """{"name":"Changed"}""");
        await api.PatchAsync(owner, id, """{"name":null}""");

        Assert.AreEqual(1, api.Events.Raised.Count(e => e.SiteId == id && e.Change == "updated"));
        Assert.AreEqual(1, api.Events.Raised.Count(e => e.SiteId == id && e.Change == "created"));
    }
}

using System.Net;

namespace Hivesite.Content.Tests;

[Collection(ContentApiDefinition.Name)]
public sealed class UpdateSiteTests(ContentApi fixture)
{
    [Fact]
    public async Task Patching_the_name_leaves_the_rest_and_moves_updated_at_AC18()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"nl","description":"Keep"}""");
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, created.Text("id"), """{"name":"  Renamed "}""");

        Assert.Equal(HttpStatusCode.OK, response.Status);
        Assert.Equal("Renamed", response.Text("name"));
        Assert.Equal(created.Text("slug"), response.Text("slug"));
        Assert.Equal("nl", response.Text("settings", "language"));
        Assert.Equal("Keep", response.Text("settings", "description"));
        Assert.Equal(created.Text("created_at"), response.Text("created_at"));
        Assert.True(DateTime.Parse(response.Text("updated_at"), System.Globalization.CultureInfo.InvariantCulture) > DateTime.Parse(created.Text("updated_at"), System.Globalization.CultureInfo.InvariantCulture));
        var read = await api.GetAsync(owner, "/sites/" + created.Text("id"));
        Assert.Equal(response.Body.GetRawText(), read.Body.GetRawText());
    }

    [Fact]
    public async Task Settings_merge_one_level_deep_and_the_slug_can_change_AC19()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"nl","description":"Old"}""");
        var slug = ContentApi.NewSlug();

        var response = await api.PatchAsync(owner, created.Text("id"), "{\"slug\":\"" + slug + "\",\"settings\":{\"description\":\"New\"}}");

        Assert.Equal("nl", response.Text("settings", "language"));
        Assert.Equal("New", response.Text("settings", "description"));
        Assert.Equal(slug, response.Text("slug"));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"settings":{}}""")]
    [InlineData("""{"name":"Site","settings":{"language":"en","description":""}}""")]
    public async Task A_patch_that_changes_nothing_is_a_no_op_AC20(string body)
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner);
        var raised = api.Events.Raised.Count;
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, created.Text("id"), body);

        Assert.Equal(HttpStatusCode.OK, response.Status);
        Assert.Equal(created.Body.GetRawText(), response.Body.GetRawText());
        Assert.Equal(raised, api.Events.Raised.Count);
    }

    [Theory]
    [InlineData("""{"name":5}""", "/name")]
    [InlineData("""{"name":null}""", "/name")]
    [InlineData("""{"theme":"x"}""", "/theme")]
    [InlineData("""{"settings":{"extra":1}}""", "/settings/extra")]
    [InlineData("""{"settings":{"language":null}}""", "/settings/language")]
    [InlineData("""{"slug":"AB"}""", "/slug")]
    public async Task Invalid_input_is_refused_and_nothing_is_stored_AC21(string body, string field)
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner);

        var response = await api.PatchAsync(owner, created.Text("id"), body);
        var read = await api.GetAsync(owner, "/sites/" + created.Text("id"));

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_request", response.ErrorCode);
        Assert.Equal(field, response.ErrorField);
        Assert.Equal(created.Body.GetRawText(), read.Body.GetRawText());
    }

    [Fact]
    public async Task A_taken_slug_is_refused_but_ones_own_slug_is_not_a_conflict_AC22()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var site = await api.CreateAsync(owner);
        var foreign = await api.CreateAsync(ContentApi.NewOwner());

        var taken = await api.PatchAsync(owner, site.Text("id"), $$"""{"slug":"{{foreign.Text("slug")}}"}""");
        var own = await api.PatchAsync(owner, site.Text("id"), $$"""{"slug":"{{site.Text("slug")}}"}""");

        Assert.Equal(HttpStatusCode.BadRequest, taken.Status);
        Assert.Equal("slug_taken", taken.ErrorCode);
        Assert.Equal("/slug", taken.ErrorField);
        Assert.Equal(HttpStatusCode.OK, own.Status);
    }

    [Fact]
    public async Task A_changing_patch_raises_updated_once_AC23()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var id = (await api.CreateAsync(owner)).Text("id");

        await api.PatchAsync(owner, id, """{"name":"Changed"}""");
        await api.PatchAsync(owner, id, """{"name":"Changed"}""");
        await api.PatchAsync(owner, id, """{"name":null}""");

        Assert.Equal(1, api.Events.Raised.Count(e => e.SiteId == id && e.Change == "updated"));
        Assert.Equal(1, api.Events.Raised.Count(e => e.SiteId == id && e.Change == "created"));
    }
}

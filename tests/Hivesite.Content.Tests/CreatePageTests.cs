using System.Net;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class CreatePageTests
{
    private static Task<ApiResponse> PostAsync(ContentApi api, string? owner, string siteId, string json) =>
        api.SendAsync(HttpMethod.Post, $"/sites/{siteId}/pages", owner, json);

    [TestMethod]
    public async Task The_owner_creates_a_page_AC1()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await PostAsync(api, owner, siteId, """{"title":"  Our work ","slug":"our-work"}""");

        Assert.AreEqual(HttpStatusCode.Created, response.Status);
        var id = response.Text("id");
        Assert.AreEqual($"/pages/{id}", response.Raw.Headers.Location!.ToString());
        Assert.AreEqual(siteId, response.Text("site_id"));
        Assert.AreEqual("Our work", response.Text("title"));
        Assert.AreEqual("our-work", response.Text("slug"));
        Assert.AreEqual(0, response.Node("menu_order").GetInt32());
        Assert.AreEqual(response.Text("created_at"), response.Text("updated_at"));
        Assert.AreEqual(7, Guid.Parse(id).Version);
        var read = await api.GetAsync(owner, "/pages/" + id);
        Assert.AreEqual(response.Body.GetRawText(), read.Body.GetRawText());
    }

    [TestMethod]
    public async Task A_new_page_goes_to_the_end_of_the_menu_AC2()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        for (var i = 0; i < 3; i++)
        {
            var page = await api.CreatePageAsync(owner, siteId);
            Assert.AreEqual(i, page.Node("menu_order").GetInt32());
        }
    }

    [TestMethod]
    [DataRow("not json")]
    [DataRow("""{"slug":"a"}""")]
    [DataRow("""{"title":"A"}""")]
    [DataRow("""{"title":null,"slug":"a"}""")]
    [DataRow("""{"title":1,"slug":"a"}""")]
    [DataRow("""{"title":"A","slug":"a","extra":1}""")]
    [DataRow("""{"title":"A","slug":"a","menu_order":1}""")]
    public async Task A_broken_body_is_refused_AC3(string body)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await PostAsync(api, owner, siteId, body);

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
    }

    [TestMethod]
    [DataRow("""{"slug":"a"}""", "/title")]
    [DataRow("""{"title":"A"}""", "/slug")]
    [DataRow("""{"title":"A","slug":"a","extra":1}""", "/extra")]
    public async Task The_refusal_names_the_field_AC3(string body, string field)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await PostAsync(api, owner, siteId, body);

        Assert.AreEqual(field, response.ErrorField);
    }

    [TestMethod]
    public async Task Values_at_the_limit_are_accepted_and_over_it_refused_AC4()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var ok = await PostAsync(api, owner, siteId, $$"""{"title":"{{new string('t', 80)}}","slug":"{{new string('s', 60)}}"}""");
        var longTitle = await PostAsync(api, owner, siteId, $$"""{"title":"{{new string('t', 81)}}","slug":"a"}""");
        var longSlug = await PostAsync(api, owner, siteId, $$"""{"title":"A","slug":"{{new string('s', 61)}}"}""");

        Assert.AreEqual(HttpStatusCode.Created, ok.Status);
        Assert.AreEqual("/title", longTitle.ErrorField);
        Assert.AreEqual("/slug", longSlug.ErrorField);
        Assert.AreEqual("invalid_request", longSlug.ErrorCode);
    }

    [TestMethod]
    [DataRow("   ", "a")]
    [DataRow("A", "Upper")]
    [DataRow("A", "-a")]
    [DataRow("A", "a-")]
    [DataRow("A", "a b")]
    [DataRow("A", "")]
    public async Task Bad_titles_and_slugs_are_refused_AC4(string title, string slug)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        var response = await PostAsync(api, owner, siteId, $$"""{"title":"{{title}}","slug":"{{slug}}"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
    }

    [TestMethod]
    public async Task The_slug_assets_is_reserved_AC5()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var page = await api.CreatePageAsync(owner, siteId);

        var post = await PostAsync(api, owner, siteId, """{"title":"A","slug":"assets"}""");
        var patch = await api.SendAsync(HttpMethod.Patch, "/pages/" + page.Text("id"), owner, """{"slug":"assets"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, post.Status);
        Assert.AreEqual("slug_reserved", post.ErrorCode);
        Assert.AreEqual(HttpStatusCode.BadRequest, patch.Status);
        Assert.AreEqual("slug_reserved", patch.ErrorCode);
    }

    [TestMethod]
    public async Task A_taken_slug_is_refused_but_another_site_may_reuse_it_AC6()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var otherSite = (await api.CreateAsync(owner)).Text("id");
        await api.CreatePageAsync(owner, siteId, "about");

        var taken = await PostAsync(api, owner, siteId, """{"title":"A","slug":"about"}""");
        var reused = await PostAsync(api, owner, otherSite, """{"title":"A","slug":"about"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, taken.Status);
        Assert.AreEqual("slug_taken", taken.ErrorCode);
        Assert.AreEqual(HttpStatusCode.Created, reused.Status);
    }

    [TestMethod]
    public async Task The_51st_page_is_refused_AC7()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        for (var i = 0; i < 50; i++)
        {
            await api.CreatePageAsync(owner, siteId, "p" + i);
        }

        var response = await PostAsync(api, owner, siteId, """{"title":"A","slug":"one-more"}""");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("too_many_pages", response.ErrorCode);
        Assert.HasCount(50, await api.MenuAsync(owner, siteId));
    }

    [TestMethod]
    [DataRow("missing")]
    [DataRow("other")]
    [DataRow("abc")]
    public async Task Unknown_foreign_and_malformed_site_ids_give_one_identical_404_AC8(string kind)
    {
        var api = await ContentApi.ReadyAsync();
        var foreign = (await api.CreateAsync(ContentApi.NewOwner())).Text("id");
        var id = kind switch { "missing" => Guid.CreateVersion7().ToString(), "other" => foreign, _ => "abc" };
        var owner = ContentApi.NewOwner();
        var baseline = await api.GetAsync(owner, $"/sites/{Guid.CreateVersion7()}/pages");

        var post = await PostAsync(api, owner, id, """{"title":"A","slug":"a"}""");
        var list = await api.GetAsync(owner, $"/sites/{id}/pages");
        var menu = await api.PutMenuAsync(owner, id);

        foreach (var r in new[] { post, list, menu })
        {
            Assert.AreEqual(HttpStatusCode.NotFound, r.Status);
            Assert.AreEqual("site_not_found", r.ErrorCode);
            Assert.IsNull(r.ErrorField);
            Assert.AreEqual(baseline.Body.GetRawText(), r.Body.GetRawText());
        }
    }

    [TestMethod]
    public async Task Without_an_owner_all_six_endpoints_are_unauthenticated_AC9()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var pageId = (await api.CreatePageAsync(owner, siteId)).Text("id");

        var responses = new[]
        {
            await PostAsync(api, null, siteId, """{"title":"A","slug":"a"}"""),
            await api.GetAsync(null, $"/sites/{siteId}/pages"),
            await api.GetAsync(null, $"/pages/{pageId}"),
            await api.SendAsync(HttpMethod.Patch, $"/pages/{pageId}", null, "{}"),
            await api.SendAsync(HttpMethod.Delete, $"/pages/{pageId}", null),
            await api.PutMenuAsync(null, siteId, pageId),
        };

        foreach (var r in responses)
        {
            Assert.AreEqual(HttpStatusCode.Unauthorized, r.Status);
            Assert.AreEqual("unauthenticated", r.ErrorCode);
        }
    }
}

using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Hivesite.Content.Contracts;
using Hivesite.Content.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Tests;

/// <summary>The site snapshot of API-011 through <see cref="IContentApi"/>, resolved from the host's DI, against PostgreSQL.</summary>
[TestClass]
public sealed class SiteSnapshotTests
{
    private const string Empty = """{"type":"doc","content":[]}""";

    private static readonly JsonSerializerOptions Snake = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    private static string Example() => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Examples", "site-snapshot.json"));

    /// <summary>Calls the API as <paramref name="owner"/>: a scope with a signed-in request, as the Host would have.</summary>
    private static async Task<T> AsAsync<T>(ContentApi api, string? owner, Func<IContentApi, Task<T>> call)
    {
        await using var scope = api.Services.CreateAsyncScope();
        var user = new ClaimsPrincipal(new ClaimsIdentity(owner is null ? [] : [new Claim(ClaimTypes.NameIdentifier, owner)], "Test"));
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext { User = user };
        return await call(scope.ServiceProvider.GetRequiredService<IContentApi>());
    }

    private static Task<SiteSnapshot?> SnapshotAsync(ContentApi api, string owner, string siteId) =>
        AsAsync(api, owner, a => a.GetSiteSnapshotAsync(Guid.Parse(siteId)));

    private static Task<ApiResponse> PutBlocksAsync(ContentApi api, string owner, string pageId, string json) =>
        api.SendAsync(HttpMethod.Put, $"/pages/{pageId}/blocks", owner, json);

    [TestMethod]
    public async Task The_snapshot_equals_the_spec_example_AC7()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = new DateTime(2026, 10, 28, 9, 20, 0, DateTimeKind.Utc);
        await using (var scope = api.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ContentDbContext>();
            var siteId = Guid.Parse("01a181c9-b7ca-70bc-abf5-a9e81e300af7");
            db.Sites.Add(new SiteDao
            {
                Id = siteId,
                OwnerId = owner,
                Name = "Atelier Noor",
                Slug = "atelier-noor",
                Language = "nl",
                Description = "Handmade ceramics from Utrecht.",
                Theme = "atelier",
                CreatedAt = created,
                UpdatedAt = created,
            });
            // Inserted in reverse so that menu_order, not insertion order, decides.
            db.Pages.Add(new PageDao
            {
                Id = Guid.Parse("01a181d4-5e8b-75fc-bd2f-613219bf3f79"),
                SiteId = siteId,
                Title = "About",
                Slug = "about",
                MenuOrder = 1,
                CreatedAt = new DateTime(2026, 10, 28, 9, 25, 41, DateTimeKind.Utc),
                UpdatedAt = created,
            });
            db.Pages.Add(new PageDao
            {
                Id = Guid.Parse("01a181cf-2a4a-7cd5-bb2c-5c6582ac33a0"),
                SiteId = siteId,
                Title = "Home",
                Slug = "home",
                MenuOrder = 0,
                CreatedAt = created,
                UpdatedAt = created,
            });
            await db.SaveChangesAsync();
        }

        var snapshot = await SnapshotAsync(api, owner, "01a181c9-b7ca-70bc-abf5-a9e81e300af7");

        Assert.IsNotNull(snapshot);
        var expected = JsonSerializer.Serialize(JsonDocument.Parse(Example()).RootElement);
        Assert.AreEqual(expected, JsonSerializer.Serialize(snapshot, Snake));
    }

    [TestMethod]
    public async Task Stored_blocks_come_with_their_defaults_and_pages_follow_the_menu_AC7()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner, """{"language":"de","theme":"studio"}""")).Text("id");
        var first = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var second = (await api.CreatePageAsync(owner, siteId)).Text("id");
        var saved = await PutBlocksAsync(api, owner, second, """{"type":"doc","content":[{"type":"hero","attrs":{"title":"T"}}]}""");
        Assert.AreEqual(HttpStatusCode.OK, saved.Status);
        await api.PutMenuAsync(owner, siteId, second, first);

        var snapshot = await SnapshotAsync(api, owner, siteId);

        Assert.IsNotNull(snapshot);
        Assert.AreEqual(1, snapshot.SnapshotFormat);
        Assert.AreEqual("studio", snapshot.Site.Settings.Theme);
        Assert.AreEqual("de", snapshot.Site.Settings.Language);
        CollectionAssert.AreEqual(new[] { second, first }, snapshot.Pages.Select(p => p.Id).ToArray());
        Assert.IsTrue(snapshot.Pages.Select(p => p.MenuOrder).SequenceEqual([0, 1]));
        Assert.IsTrue(System.Text.Json.Nodes.JsonNode.DeepEquals(System.Text.Json.Nodes.JsonNode.Parse(saved.Body.GetRawText()), System.Text.Json.Nodes.JsonNode.Parse(snapshot.Pages[0].Blocks.GetRawText())));
        StringAssert.Contains(snapshot.Pages[0].Blocks.GetRawText(), "\"subtitle\":\"\"");   // defaults are stored
        Assert.AreEqual(Empty, snapshot.Pages[1].Blocks.GetRawText());
    }

    [TestMethod]
    public async Task A_missing_site_or_another_owners_is_null_and_a_site_without_pages_has_none_AC8()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");

        Assert.IsNull(await SnapshotAsync(api, owner, Guid.CreateVersion7().ToString()));
        Assert.IsNull(await SnapshotAsync(api, ContentApi.NewOwner(), siteId));
        var snapshot = await SnapshotAsync(api, owner, siteId);
        Assert.IsNotNull(snapshot);
        Assert.IsEmpty(snapshot.Pages);
    }

    [TestMethod]
    public async Task The_snapshot_for_a_page_is_the_snapshot_of_its_site_AC9()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        await api.CreatePageAsync(owner, siteId);
        var pageId = (await api.CreatePageAsync(owner, siteId)).Text("id");

        var forPage = await AsAsync(api, owner, a => a.GetSiteSnapshotForPageAsync(Guid.Parse(pageId)));

        Assert.IsNotNull(forPage);
        Assert.AreEqual(JsonSerializer.Serialize(await SnapshotAsync(api, owner, siteId), Snake), JsonSerializer.Serialize(forPage, Snake));
    }

    [TestMethod]
    public async Task A_missing_page_or_one_of_another_owner_is_null_AC9()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var pageId = (await api.CreatePageAsync(owner, (await api.CreateAsync(owner)).Text("id"))).Text("id");

        Assert.IsNull(await AsAsync(api, owner, a => a.GetSiteSnapshotForPageAsync(Guid.CreateVersion7())));
        Assert.IsNull(await AsAsync(api, ContentApi.NewOwner(), a => a.GetSiteSnapshotForPageAsync(Guid.Parse(pageId))));
    }

    [TestMethod]
    public async Task The_three_reads_run_in_one_repeatable_read_transaction_and_a_later_save_is_not_in_it_AC10()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var siteId = (await api.CreateAsync(owner)).Text("id");
        var pageId = (await api.CreatePageAsync(owner, siteId)).Text("id");

        // After the first query of the snapshot, another request saves a block and commits.
        var recording = DatabaseRecorder.Record(async () =>
            Assert.AreEqual(HttpStatusCode.OK, (await PutBlocksAsync(api, owner, pageId, """{"type":"doc","content":[{"type":"hero","attrs":{"title":"Late"}}]}""")).Status));
        var snapshot = await SnapshotAsync(api, owner, siteId);

        Assert.IsTrue(recording.HookRan);
        Assert.IsNotNull(snapshot);
        Assert.AreEqual(Empty, snapshot.Pages[0].Blocks.GetRawText());   // the save happened, the snapshot does not see it
        var events = recording.Events;
        Assert.AreEqual("begin RepeatableRead", events[0]);
        Assert.AreEqual("commit", events[^1]);
        Assert.AreEqual(1, events.Count(e => e.StartsWith("begin", StringComparison.Ordinal)));
        foreach (var table in new[] { "content.sites", "content.pages", "content.\"pageBlocks\"" })
        {
            Assert.IsTrue(events.Any(e => e.StartsWith("query", StringComparison.Ordinal) && e.Contains(table, StringComparison.Ordinal)), table + " in " + string.Join(" | ", events));
        }
        Assert.IsTrue((await SnapshotAsync(api, owner, siteId))!.Pages[0].Blocks.GetRawText().Contains("Late", StringComparison.Ordinal));
    }

    [TestMethod]
    public void The_snapshot_types_are_records_of_the_contracts_and_the_methods_are_named_by_the_spec_AC11()
    {
        var contracts = typeof(IContentApi).Assembly;
        foreach (var name in new[] { "SiteSnapshot", "SnapshotSite", "SnapshotSiteSettings", "SnapshotPage" })
        {
            var type = contracts.GetType("Hivesite.Content.Contracts." + name);
            Assert.IsNotNull(type, name);
            Assert.IsNotNull(type.GetMethod("<Clone>$"), name + " is a record");
        }
        Assert.AreEqual(typeof(JsonElement), typeof(SnapshotPage).GetProperty(nameof(SnapshotPage.Blocks))!.PropertyType);
        Assert.IsNotNull(typeof(IContentApi).GetMethod("GetSiteSnapshotAsync"));
        Assert.IsNotNull(typeof(IContentApi).GetMethod("GetSiteSnapshotForPageAsync"));
        var internals = new[] { typeof(Domain.Site), typeof(Domain.Page), typeof(Domain.PageBlocks) };
        var leaked = typeof(IContentApi).GetMethods().SelectMany(m => m.ReturnType.GetGenericArguments().Append(m.ReturnType))
            .SelectMany(t => t.GetGenericArguments().Append(t)).Intersect(internals);
        Assert.IsEmpty(leaked.ToList());
    }
}

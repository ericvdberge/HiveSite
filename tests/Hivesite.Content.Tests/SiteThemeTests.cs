using System.Net;
using Hivesite.Content.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Hivesite.Content.Tests;

/// <summary>The site theme (API-001 v4) over HTTP: AC1 to AC5.</summary>
[TestClass]
public sealed class SiteThemeTests
{
    [TestMethod]
    public async Task Patching_the_theme_changes_only_the_theme_and_raises_updated_once_AC1()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"nl","description":"Keep"}""");
        var id = created.Text("id");
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, id, """{"settings":{"theme":"ivory"}}""");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual("ivory", response.Text("settings", "theme"));
        Assert.AreEqual("nl", response.Text("settings", "language"));
        Assert.AreEqual("Keep", response.Text("settings", "description"));
        Assert.AreNotEqual(created.Text("updated_at"), response.Text("updated_at"));
        Assert.AreEqual(1, api.Events.Raised.Count(e => e.SiteId == id && e.Change == "updated"));
        Assert.AreEqual("ivory", (await api.GetAsync(owner, "/sites/" + id)).Text("settings", "theme"));
        var list = await api.GetAsync(owner, "/sites");
        Assert.AreEqual("ivory", list.Node("items")[0].GetProperty("settings").GetProperty("theme").GetString());
    }

    [TestMethod]
    [DataRow(null, "atelier")]
    [DataRow("""{"language":"de"}""", "atelier")]
    [DataRow("""{"theme":"studio"}""", "studio")]
    public async Task A_new_site_gets_the_default_theme_unless_one_is_sent_AC2(string? settings, string expected)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.CreateAsync(ContentApi.NewOwner(), settings);

        Assert.AreEqual(expected, response.Text("settings", "theme"));
    }

    [TestMethod]
    [DataRow("\"\"")]
    [DataRow("\"Atelier\"")]
    [DataRow("\"dark\"")]
    [DataRow("\"ivory,studio\"")]
    [DataRow("5")]
    [DataRow("{}")]
    public async Task An_invalid_theme_is_refused_and_nothing_is_stored_or_raised_AC3(string theme)
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner);
        var id = created.Text("id");
        var raised = api.Events.Raised.Count;

        var patched = await api.PatchAsync(owner, id, $$$"""{"settings":{"theme":{{{theme}}}}}""");
        var posted = await api.PostAsync(owner, $$$"""{"name":"A","slug":"{{{ContentApi.NewSlug()}}}","settings":{"theme":{{{theme}}}}}""");

        foreach (var response in new[] { patched, posted })
        {
            Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
            Assert.AreEqual("invalid_request", response.ErrorCode);
            Assert.AreEqual("/settings/theme", response.ErrorField);
        }
        Assert.AreEqual(created.Body.GetRawText(), (await api.GetAsync(owner, "/sites/" + id)).Body.GetRawText());
        Assert.AreEqual(raised, api.Events.Raised.Count);
        Assert.AreEqual(1, (await api.GetAsync(owner, "/sites")).Node("items").GetArrayLength());
    }

    [TestMethod]
    public async Task A_null_theme_in_a_patch_is_not_sent_and_a_padded_one_is_trimmed_AC3()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var id = (await api.CreateAsync(owner, """{"theme":"studio"}""")).Text("id");

        var unchanged = await api.PatchAsync(owner, id, """{"settings":{"theme":null}}""");
        var trimmed = await api.PatchAsync(owner, id, """{"settings":{"theme":" ivory "}}""");

        Assert.AreEqual(HttpStatusCode.OK, unchanged.Status);
        Assert.AreEqual("studio", unchanged.Text("settings", "theme"));
        Assert.AreEqual("ivory", trimmed.Text("settings", "theme"));
    }

    [TestMethod]
    public async Task Patching_the_same_theme_is_a_no_op_AC4()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"theme":"ivory"}""");
        var raised = api.Events.Raised.Count;
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await api.PatchAsync(owner, created.Text("id"), """{"settings":{"theme":"ivory"}}""");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        Assert.AreEqual(created.Text("updated_at"), response.Text("updated_at"));
        Assert.AreEqual(raised, api.Events.Raised.Count);
    }

    [TestMethod]
    public async Task The_migration_gives_existing_sites_the_atelier_theme_AC5()
    {
        await ContentApi.ReadyAsync();
        var connection = new NpgsqlConnectionStringBuilder(ContentApi.ConnectionString) { Database = "site_theme_migration" }.ConnectionString;
        var options = new DbContextOptionsBuilder<ContentDbContext>();
        ContentModule.Configure(options, connection);
        await using var db = new ContentDbContext(options.Options);
        await db.Database.EnsureDeletedAsync();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261101204549_CreatePageBlocks");   // the last migration before AddSiteTheme
        await using var npgsql = new NpgsqlConnection(connection);
        await npgsql.OpenAsync();
        await using (var insert = new NpgsqlCommand(
            """insert into content.sites (id, "ownerId", name, slug, language, description, "createdAt", "updatedAt") values (@id, 'o', 'Old', 'old-site', 'en', '', now(), now())""", npgsql))
        {
            insert.Parameters.AddWithValue("id", Guid.CreateVersion7());
            await insert.ExecuteNonQueryAsync();
        }

        await migrator.MigrateAsync();

        await using var select = new NpgsqlCommand("select theme from content.sites where slug = 'old-site'", npgsql);
        Assert.AreEqual("atelier", await select.ExecuteScalarAsync());
    }
}

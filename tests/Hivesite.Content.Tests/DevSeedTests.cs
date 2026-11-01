using System.Security.Claims;
using System.Text.RegularExpressions;
using Hivesite.Content.Application;
using Hivesite.Content.Domain;
using Hivesite.Content.Seeding;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class DevSeedTests
{
    private static readonly Regex SlugPattern = new("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$");

    private static async Task<ContentApi> SeededAsync()
    {
        var api = await ContentApi.ReadyAsync();
        await api.Services.SeedContentDevelopmentDataAsync();
        return api;
    }

    /// <summary>Runs <paramref name="read"/> in a scope signed in as <paramref name="owner"/>.</summary>
    private static async Task<T> AsAsync<T>(IServiceProvider services, string owner, Func<IServiceProvider, Task<T>> read)
    {
        await using var scope = services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, owner)], "Test")),
        };
        return await read(scope.ServiceProvider);
    }

    private static Task<List<Site>> SitesAsync(IServiceProvider services, string owner) =>
        AsAsync(services, owner, async sp => (await sp.GetRequiredService<SiteService>().ListAsync(new SiteFilter { Limit = 10 }, default)).Value.Items.ToList());

    private static Task<List<Page>> PagesAsync(IServiceProvider services, string owner, Guid siteId) =>
        AsAsync(services, owner, async sp => (await sp.GetRequiredService<PageService>().ListAsync(new PageFilter { SiteId = siteId, Limit = 50 }, default)).Value.Items.ToList());

    /// <summary>An app on its own empty database, so "nothing was written" can be told from "already seeded".</summary>
    private static async Task<WebApplicationFactory<Program>> OwnDatabaseAsync(string environment, string database)
    {
        var connection = new NpgsqlConnectionStringBuilder(ContentApi.ConnectionString) { Database = database }.ConnectionString;
        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("ConnectionStrings:Content", connection);
        });
        await factory.Services.MigrateContentDatabaseAsync();
        return factory;
    }

    [TestMethod]
    public async Task Seed_writes_nothing_outside_Development_AC1()
    {
        await ContentApi.ReadyAsync();
        await using var factory = await OwnDatabaseAsync("Production", "seed_production");

        await factory.Services.SeedContentDevelopmentDataAsync();

        Assert.AreEqual(0, (await SitesAsync(factory.Services, DevSeeder.OwnerA)).Count);
        Assert.AreEqual(0, (await SitesAsync(factory.Services, DevSeeder.OwnerB)).Count);
    }

    [TestMethod]
    public async Task Seed_does_not_run_at_startup_in_Development_AC1()
    {
        await ContentApi.ReadyAsync();
        await using var factory = await OwnDatabaseAsync("Development", "seed_startup");

        Assert.AreEqual(0, (await SitesAsync(factory.Services, DevSeeder.OwnerA)).Count);

        await factory.Services.SeedContentDevelopmentDataAsync();

        Assert.AreEqual(3, (await SitesAsync(factory.Services, DevSeeder.OwnerA)).Count);
    }

    [TestMethod]
    public async Task Seeded_slugs_are_valid_unique_menu_order_has_no_gaps_and_events_were_raised_AC2()
    {
        var api = await SeededAsync();
        var sites = (await SitesAsync(api.Services, DevSeeder.OwnerA)).Concat(await SitesAsync(api.Services, DevSeeder.OwnerB)).ToList();

        Assert.AreEqual(sites.Count, sites.Select(s => s.Slug).Distinct().Count());
        foreach (var site in sites)
        {
            var siteId = site.Id.ToString("D");
            Assert.IsTrue(SlugPattern.IsMatch(site.Slug) && site.Slug.Length is >= 3 and <= 40);
            var pages = await PagesAsync(api.Services, site.OwnerId, site.Id);
            Assert.AreEqual(pages.Count, pages.Select(p => p.Slug).Distinct().Count());
            Assert.IsTrue(pages.All(p => SlugPattern.IsMatch(p.Slug) && p.Slug != "assets"));
            CollectionAssert.AreEqual(Enumerable.Range(0, pages.Count).ToList(), pages.Select(p => p.MenuOrder).ToList());

            Assert.IsTrue(api.Events.Raised.Any(e => e.SiteId == siteId && e.Change == "created"));
            Assert.AreEqual(pages.Count, api.PageEvents.Pages.Count(e => e.SiteId == siteId && e.Change == "created"));
            Assert.AreEqual(pages.Count, api.MenuEventsFor(siteId));
        }
    }

    [TestMethod]
    public async Task Owner_A_has_three_sites_and_owner_B_one_AC3()
    {
        var api = await SeededAsync();
        var a = await SitesAsync(api.Services, DevSeeder.OwnerA);

        Assert.AreEqual(3, a.Count);
        Assert.AreEqual(1, (await SitesAsync(api.Services, DevSeeder.OwnerB)).Count);
        Assert.AreEqual(49, (await PagesAsync(api.Services, DevSeeder.OwnerA, a.Single(s => s.Slug == DevSeeder.FullSiteSlug).Id)).Count);
        Assert.AreEqual(0, (await PagesAsync(api.Services, DevSeeder.OwnerA, a.Single(s => s.Slug == DevSeeder.EmptySiteSlug).Id)).Count);
    }

    [TestMethod]
    public async Task One_owner_cannot_read_the_other_owners_site_AC4()
    {
        var api = await SeededAsync();
        var a = (await SitesAsync(api.Services, DevSeeder.OwnerA)).First();
        var b = (await SitesAsync(api.Services, DevSeeder.OwnerB)).First();

        Assert.IsNull(await AsAsync(api.Services, DevSeeder.OwnerB, sp => sp.GetRequiredService<SiteService>().GetAsync(a.Id, default)));
        Assert.IsNull(await AsAsync(api.Services, DevSeeder.OwnerA, sp => sp.GetRequiredService<SiteService>().GetAsync(b.Id, default)));
        Assert.IsNotNull(await AsAsync(api.Services, DevSeeder.OwnerA, sp => sp.GetRequiredService<SiteService>().GetAsync(a.Id, default)));
    }

    [TestMethod]
    public async Task Seeding_twice_duplicates_nothing_and_raises_no_events_AC5()
    {
        var api = await SeededAsync();
        var before = await CountsAsync(api);
        var events = (api.Events.Raised.Count, api.PageEvents.Pages.Count, api.PageEvents.Menus.Count);

        await api.Services.SeedContentDevelopmentDataAsync();

        CollectionAssert.AreEqual(before, await CountsAsync(api));
        Assert.AreEqual(events, (api.Events.Raised.Count, api.PageEvents.Pages.Count, api.PageEvents.Menus.Count));
    }

    /// <summary>Pages per seeded site, in a stable order.</summary>
    private static async Task<List<string>> CountsAsync(ContentApi api)
    {
        var counts = new List<string>();
        foreach (var owner in new[] { DevSeeder.OwnerA, DevSeeder.OwnerB })
        {
            foreach (var site in (await SitesAsync(api.Services, owner)).OrderBy(s => s.Slug))
            {
                counts.Add($"{owner}/{site.Slug}={(await PagesAsync(api.Services, owner, site.Id)).Count}");
            }
        }
        return counts;
    }
}

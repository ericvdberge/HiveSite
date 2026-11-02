using System.Net;
using System.Security.Claims;
using Hivesite.Content.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Tests;

/// <summary>The site summary and slug lookup of API-020 through <see cref="IContentApi"/>, against PostgreSQL.</summary>
[TestClass]
public sealed class SiteLookupTests
{
    private static async Task<T> AsAsync<T>(ContentApi api, string? owner, Func<IContentApi, Task<T>> call)
    {
        await using var scope = api.Services.CreateAsyncScope();
        var user = new ClaimsPrincipal(new ClaimsIdentity(owner is null ? [] : [new Claim(ClaimTypes.NameIdentifier, owner)], "Test"));
        scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext { User = user };
        return await call(scope.ServiceProvider.GetRequiredService<IContentApi>());
    }

    [TestMethod]
    public async Task The_owner_gets_the_summary_of_the_site_AC12()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var site = await api.CreateAsync(owner);

        var summary = await AsAsync(api, owner, a => a.GetSiteSummaryAsync(Guid.Parse(site.Text("id"))));

        Assert.AreEqual(new SiteSummary(site.Text("id"), site.Text("slug")), summary);
    }

    [TestMethod]
    public async Task A_missing_site_or_another_owners_has_no_summary_AC12()
    {
        var api = await ContentApi.ReadyAsync();
        var site = await api.CreateAsync(ContentApi.NewOwner());

        Assert.IsNull(await AsAsync(api, ContentApi.NewOwner(), a => a.GetSiteSummaryAsync(Guid.Parse(site.Text("id")))));
        Assert.IsNull(await AsAsync(api, ContentApi.NewOwner(), a => a.GetSiteSummaryAsync(Guid.NewGuid())));
    }

    [TestMethod]
    public async Task A_slug_finds_the_site_of_any_owner_and_with_nobody_signed_in_AC13()
    {
        var api = await ContentApi.ReadyAsync();
        var site = await api.CreateAsync(ContentApi.NewOwner());
        var id = Guid.Parse(site.Text("id"));
        var slug = site.Text("slug");

        Assert.AreEqual(id, await AsAsync(api, ContentApi.NewOwner(), a => a.GetSiteIdBySlugAsync(slug)));
        Assert.AreEqual(id, await AsAsync(api, null, a => a.GetSiteIdBySlugAsync(slug)));
    }

    [TestMethod]
    public async Task An_unknown_slug_or_one_in_another_case_finds_nothing_AC13()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var slug = "atelier-" + Guid.NewGuid().ToString("N")[..8];
        Assert.AreEqual(HttpStatusCode.Created, (await api.PostAsync(owner, $$"""{"name":"Site","slug":"{{slug}}"}""")).Status);

        Assert.IsNull(await AsAsync(api, owner, a => a.GetSiteIdBySlugAsync("unknown-" + slug)));
        Assert.IsNull(await AsAsync(api, owner, a => a.GetSiteIdBySlugAsync(slug.ToUpperInvariant())));
    }

    [TestMethod]
    public async Task After_the_slug_changes_only_the_new_one_finds_the_site_AC13()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var site = await api.CreateAsync(owner);
        var oldSlug = site.Text("slug");
        var newSlug = ContentApi.NewSlug();

        Assert.AreEqual(HttpStatusCode.OK, (await api.PatchAsync(owner, site.Text("id"), $$"""{"slug":"{{newSlug}}"}""")).Status);

        Assert.IsNull(await AsAsync(api, owner, a => a.GetSiteIdBySlugAsync(oldSlug)));
        Assert.AreEqual(Guid.Parse(site.Text("id")), await AsAsync(api, owner, a => a.GetSiteIdBySlugAsync(newSlug)));
    }
}

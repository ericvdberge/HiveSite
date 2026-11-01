using System.Security.Claims;
using Hivesite.Content.Application;
using Hivesite.Content.Domain;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Seeding;

/// <summary>
/// Sample sites and pages for local studio work. Everything goes through <see cref="SiteService"/> and
/// <see cref="PageService"/>, so the rules of API-001 and API-002 hold and the change events are raised.
/// What exists (site slug, then page slug within the site) is skipped, so a second run changes nothing.
/// A failed rule is a bug in the seed data: <c>Result.Value</c> throws with the error code.
/// </summary>
internal sealed class DevSeeder(IServiceProvider services)
{
    public const string OwnerA = "dev-owner-a";
    public const string OwnerB = "dev-owner-b";
    public const string FullSiteSlug = "dev-atelier-full";
    public const string EmptySiteSlug = "dev-atelier-empty";
    public const int FullSitePages = 49;

    private static readonly SeedSite[] Sites =
    [
        new(OwnerA, "Atelier Nord", "dev-atelier-nord", "A small studio site.", ["home", "about", "work", "contact"]),
        new(OwnerA, "Atelier Full", FullSiteSlug, "A site one page short of the limit.", Enumerable.Range(1, FullSitePages).Select(i => $"page-{i}").ToArray()),
        new(OwnerA, "Atelier Empty", EmptySiteSlug, "A site without pages.", []),
        new(OwnerB, "Bureau Blau", "dev-bureau-blau", "Another owner's site.", ["home", "journal"]),
    ];

    public async Task RunAsync(CancellationToken ct)
    {
        foreach (var owner in Sites.Select(s => s.Owner).Distinct())
        {
            // One scope per owner, signed in through the claim UserContext reads, so no HTTP request is needed.
            await using var scope = services.CreateAsyncScope();
            var http = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
            http.HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, owner)], "Seed")),
            };
            try
            {
                foreach (var seed in Sites.Where(s => s.Owner == owner))
                {
                    await SeedSiteAsync(seed, scope.ServiceProvider, ct);
                }
            }
            finally
            {
                http.HttpContext = null;
            }
        }
    }

    private static async Task SeedSiteAsync(SeedSite seed, IServiceProvider scope, CancellationToken ct)
    {
        var siteService = scope.GetRequiredService<SiteService>();
        var pageService = scope.GetRequiredService<PageService>();

        var owned = await siteService.ListAsync(new SiteFilter { Limit = SiteService.MaxSitesPerOwner }, ct);
        var site = owned.Value.Items.FirstOrDefault(s => s.Slug == seed.Slug)
            ?? (await siteService.CreateAsync(new Site { Name = seed.Name, Slug = seed.Slug, Description = seed.Description }, ct)).Value;

        var have = (await pageService.ListAsync(new PageFilter { SiteId = site.Id, Limit = PageService.MaxPagesPerSite }, ct)).Value.Items
            .Select(p => p.Slug).ToHashSet();
        foreach (var slug in seed.PageSlugs.Where(s => !have.Contains(s)))
        {
            _ = (await pageService.CreateAsync(new Page { SiteId = site.Id, Title = Title(slug), Slug = slug }, ct)).Value;
        }
    }

    private static string Title(string slug) => char.ToUpperInvariant(slug[0]) + slug[1..].Replace('-', ' ');

    private sealed record SeedSite(string Owner, string Name, string Slug, string Description, string[] PageSlugs);
}

using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class SiteMapperTests
{
    private static Site Stored() => new()
    {
        Id = Guid.CreateVersion7(),
        OwnerId = "owner",
        Name = "Atelier",
        Slug = "atelier",
        Language = "nl",
        Description = "Ceramics.",
    };

    [TestMethod]
    public void A_post_without_settings_gets_the_defaults_AC2()
    {
        var site = SiteMapper.ToEntity(new SitePostDto { Name = "A", Slug = "abc" });

        Assert.AreEqual("en", site.Language);
        Assert.AreEqual("", site.Description);
        Assert.AreEqual("atelier", site.Theme);
    }

    [TestMethod]
    public void A_theme_is_mapped_on_post_and_merged_on_patch_AC1_AC2()
    {
        var posted = SiteMapper.ToEntity(new SitePostDto { Name = "A", Slug = "abc", Settings = new SiteSettingsInputDto { Theme = " studio " } });
        var site = Stored();

        SiteMapper.Apply(new SitePatchDto { Settings = new SiteSettingsInputDto { Theme = "ivory" } }, site);

        Assert.AreEqual("studio", posted.Theme);
        Assert.AreEqual("ivory", site.Theme);
        Assert.AreEqual("nl", site.Language);
    }

    [TestMethod]
    public void A_patch_changes_only_the_fields_sent_AC18_AC19()
    {
        var site = Stored();

        SiteMapper.Apply(new SitePatchDto { Name = "New", Settings = new SiteSettingsInputDto { Description = "Glaze." } }, site);

        Assert.AreEqual("New", site.Name);
        Assert.AreEqual("atelier", site.Slug);
        Assert.AreEqual("nl", site.Language);
        Assert.AreEqual("Glaze.", site.Description);
        Assert.AreEqual("owner", site.OwnerId);
    }

    [TestMethod]
    public void The_response_nests_settings_AC3()
    {
        var site = Stored();

        var dto = SiteMapper.ToDto(site);

        Assert.AreEqual(new SiteSettingsDto("nl", "Ceramics.", "atelier"), dto.Settings);
        Assert.AreEqual(site.Id, dto.Id);
    }
}

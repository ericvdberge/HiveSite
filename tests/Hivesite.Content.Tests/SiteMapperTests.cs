using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

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

    [Fact]
    public void A_post_without_settings_gets_the_defaults_AC2()
    {
        var site = SiteMapper.ToEntity(new SitePostDto { Name = "A", Slug = "abc" });

        Assert.Equal("en", site.Language);
        Assert.Equal("", site.Description);
    }

    [Fact]
    public void A_patch_changes_only_the_fields_sent_AC18_AC19()
    {
        var site = Stored();

        SiteMapper.Apply(new SitePatchDto { Name = "New", Settings = new SiteSettingsInputDto { Description = "Glaze." } }, site);

        Assert.Equal("New", site.Name);
        Assert.Equal("atelier", site.Slug);
        Assert.Equal("nl", site.Language);
        Assert.Equal("Glaze.", site.Description);
        Assert.Equal("owner", site.OwnerId);
    }

    [Fact]
    public void The_response_nests_settings_AC3()
    {
        var site = Stored();

        var dto = SiteMapper.ToDto(site);

        Assert.Equal(new SiteSettingsDto("nl", "Ceramics."), dto.Settings);
        Assert.Equal(site.Id, dto.Id);
    }
}

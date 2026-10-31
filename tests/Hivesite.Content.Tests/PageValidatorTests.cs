using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class PageValidatorTests
{
    [TestMethod]
    public void Title_and_slug_limits_count_code_points_AC4()
    {
        var validator = new PagePostValidator();

        Assert.IsTrue(validator.Validate(new PagePostDto { Title = new string('t', 80), Slug = new string('s', 60) }).IsValid);
        Assert.IsTrue(validator.Validate(new PagePostDto { Title = string.Concat(Enumerable.Repeat("😀", 80)), Slug = "a" }).IsValid);
        Assert.IsFalse(validator.Validate(new PagePostDto { Title = new string('t', 81), Slug = "a" }).IsValid);
        Assert.IsFalse(validator.Validate(new PagePostDto { Title = "  ", Slug = "a" }).IsValid);
        Assert.IsFalse(validator.Validate(new PagePostDto { Title = "A", Slug = new string('s', 61) }).IsValid);
        Assert.IsFalse(validator.Validate(new PagePostDto { Title = "A", Slug = "-a" }).IsValid);
        Assert.IsFalse(validator.Validate(new PagePostDto { Title = "A", Slug = "A" }).IsValid);
    }

    [TestMethod]
    public void A_post_needs_title_and_slug_but_a_patch_does_not_AC3()
    {
        Assert.IsFalse(new PagePostValidator().Validate(new PagePostDto()).IsValid);
        Assert.IsTrue(new PagePatchValidator().Validate(new PagePatchDto()).IsValid);
    }

    [TestMethod]
    public void The_menu_needs_distinct_ids_and_at_most_50_AC26()
    {
        var validator = new MenuPutValidator();
        var id = Guid.CreateVersion7();

        Assert.IsFalse(validator.Validate(new MenuPutDto()).IsValid);
        Assert.IsTrue(validator.Validate(new MenuPutDto { PageIds = [] }).IsValid);
        Assert.IsFalse(validator.Validate(new MenuPutDto { PageIds = [id, id] }).IsValid);
        Assert.IsTrue(validator.Validate(new MenuPutDto { PageIds = Enumerable.Range(0, 50).Select(_ => Guid.CreateVersion7()).ToList() }).IsValid);
        Assert.IsFalse(validator.Validate(new MenuPutDto { PageIds = Enumerable.Range(0, 51).Select(_ => Guid.CreateVersion7()).ToList() }).IsValid);
    }

    [TestMethod]
    public void A_patch_changes_only_title_and_slug_AC16()
    {
        var page = new Page { Id = Guid.CreateVersion7(), SiteId = Guid.CreateVersion7(), Title = "Old", Slug = "old", MenuOrder = 3 };

        PageMapper.Apply(new PagePatchDto { Title = "New" }, page);

        Assert.AreEqual("New", page.Title);
        Assert.AreEqual("old", page.Slug);
        Assert.AreEqual(3, page.MenuOrder);
    }

    [TestMethod]
    public void A_post_takes_the_site_from_the_route_AC1()
    {
        var siteId = Guid.CreateVersion7();

        var page = PageMapper.ToEntity(new PagePostDto { Title = "A", Slug = "a" }, siteId);

        Assert.AreEqual(siteId, page.SiteId);
    }
}

using System.Text.Json;
using Hivesite.Content.Domain;

namespace Hivesite.Content.Tests;

/// <summary>Content's copy of the theme keys against <c>design/tokens.json</c> (API-010). No database.</summary>
[TestClass]
public sealed class SiteThemeTokensTests
{
    private static JsonElement Tokens()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Hivesite.slnx")))
        {
            dir = dir.Parent;
        }
        Assert.IsNotNull(dir, "Hivesite.slnx not found above the test output folder.");
        return JsonDocument.Parse(File.ReadAllText(Path.Combine(dir.FullName, "design", "tokens.json"))).RootElement;
    }

    [TestMethod]
    public void The_theme_keys_are_the_keys_of_design_tokens_AC6()
    {
        var inFile = Tokens().GetProperty("themes").EnumerateObject().Select(p => p.Name).Order().ToArray();

        CollectionAssert.AreEqual(inFile, SiteThemes.Keys.Order().ToArray());
    }

    [TestMethod]
    public void The_default_theme_is_the_default_of_design_tokens_AC6()
    {
        Assert.AreEqual(SiteThemes.Default, Tokens().GetProperty("default_theme").GetString());
        CollectionAssert.Contains(SiteThemes.Keys.ToArray(), SiteThemes.Default);
    }
}

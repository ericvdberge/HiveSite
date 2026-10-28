using System.Text.Json;
using Hivesite.Content.Application;

namespace Hivesite.Content.Tests;

/// <summary>Body validation without a database: AC4, AC5, AC6 and AC21 (the same parser serves PATCH).</summary>
public sealed class SiteInputParserTests
{
    private static (SiteInput? Input, InputError? Error) Parse(string json, bool isCreate = true)
    {
        using var document = JsonDocument.Parse(json);
        return SiteInputParser.Parse(document.RootElement, isCreate);
    }

    private static string Body(string name = "Atelier", string slug = "atelier", string? language = null, string? description = null)
    {
        var settings = new Dictionary<string, string>();
        if (language is not null) { settings["language"] = language; }
        if (description is not null) { settings["description"] = description; }
        return JsonSerializer.Serialize(new Dictionary<string, object> { ["name"] = name, ["slug"] = slug, ["settings"] = settings });
    }

    [Fact]
    public void Values_are_trimmed_AC4()
    {
        var (input, error) = Parse(Body(name: "  Atelier  ", description: "\n hello \t"));

        Assert.Null(error);
        Assert.Equal("Atelier", input!.Name);
        Assert.Equal("hello", input.Description);
    }

    [Fact]
    public void Length_counts_code_points_not_utf16_units_AC4()
    {
        var emoji = "\U0001F600";

        Assert.Null(Parse(Body(name: string.Concat(Enumerable.Repeat(emoji, 80)))).Error);
        Assert.Equal("/name", Parse(Body(name: string.Concat(Enumerable.Repeat(emoji, 81)))).Error!.Field);
    }

    [Theory]
    [InlineData("""{"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A"}""", "/slug")]
    [InlineData("""{"name":1,"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A","slug":true}""", "/slug")]
    [InlineData("""{"name":"A","slug":"abc","extra":1}""", "/extra")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"extra":1}}""", "/settings/extra")]
    [InlineData("""{"name":null,"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A","slug":null}""", "/slug")]
    [InlineData("""{"name":"A","slug":"abc","settings":null}""", "/settings")]
    [InlineData("""{"name":"A","slug":"abc","settings":"x"}""", "/settings")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"language":null}}""", "/settings/language")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"description":3}}""", "/settings/description")]
    public void Bad_shapes_name_the_field_AC5(string json, string field)
    {
        var (input, error) = Parse(json);

        Assert.Null(input);
        Assert.Equal(field, error!.Field);
        Assert.Contains(field.TrimStart('/').Replace('/', '.'), error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("", "abc", null, null, "/name")]
    [InlineData("   ", "abc", null, null, "/name")]
    [InlineData("x", "ab", null, null, "/slug")]
    [InlineData("x", "abc-", null, null, "/slug")]
    [InlineData("x", "-abc", null, null, "/slug")]
    [InlineData("x", "ABC", null, null, "/slug")]
    [InlineData("x", "ab_c", null, null, "/slug")]
    [InlineData("x", "ab c", null, null, "/slug")]
    [InlineData("x", "abc", "e", null, "/settings/language")]
    [InlineData("x", "abc", "en_US", null, "/settings/language")]
    [InlineData("x", "abc", "EN", null, "/settings/language")]
    [InlineData("x", "abc", "en-", null, "/settings/language")]
    public void Values_that_break_a_limit_name_the_field_AC6(string name, string slug, string? language, string? description, string field) =>
        Assert.Equal(field, Parse(Body(name, slug, language, description)).Error!.Field);

    [Fact]
    public void Values_over_the_maximum_are_rejected_AC6()
    {
        Assert.Equal("/name", Parse(Body(name: new string('a', 81))).Error!.Field);
        Assert.Equal("/slug", Parse(Body(slug: new string('a', 41))).Error!.Field);
        Assert.Equal("/settings/language", Parse(Body(language: "en-aaaaaaaa-aaaaaaaa-aaaaaaaa-aaaaaa")).Error!.Field);
        Assert.Equal("/settings/description", Parse(Body(description: new string('a', 161))).Error!.Field);
    }

    [Fact]
    public void Values_exactly_at_a_limit_are_accepted_AC6()
    {
        Assert.Null(Parse(Body(name: new string('a', 80), slug: "abc", description: new string('a', 160))).Error);
        Assert.Null(Parse(Body(slug: new string('a', 40), language: "en-aaaaaaaa-aaaaaaaa-aaaaaaaa-aaaaa")).Error);
        Assert.Null(Parse(Body(slug: "a-b", language: "nl")).Error);
        Assert.Null(Parse(Body(description: "")).Error);
    }

    [Fact]
    public void A_patch_may_leave_out_every_field_AC21()
    {
        var (input, error) = Parse("{}", isCreate: false);

        Assert.Null(error);
        Assert.Equal(new SiteInput(null, null, null, null), input);
    }

    [Fact]
    public void A_patch_rejects_null_and_unknown_fields_AC21()
    {
        Assert.Equal("/name", Parse("""{"name":null}""", isCreate: false).Error!.Field);
        Assert.Equal("/theme", Parse("""{"theme":"x"}""", isCreate: false).Error!.Field);
    }

    [Fact]
    public void Pointers_escape_slash_and_tilde_AC5() =>
        Assert.Equal("/a~1b~0c", Parse("""{"name":"A","slug":"abc","a/b~c":1}""").Error!.Field);
}

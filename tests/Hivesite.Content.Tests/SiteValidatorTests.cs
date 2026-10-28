using System.Text.Json;
using FluentValidation;
using Hivesite.Content.Endpoints;
using Hivesite.Shared;

namespace Hivesite.Content.Tests;

/// <summary>Body rules without a database: AC4, AC5, AC6 and AC21.</summary>
public sealed class SiteValidatorTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    /// <summary>The field of the first failure, or null when the body is valid.</summary>
    private static string? FailingField<T>(string body)
        where T : SiteInputDto
    {
        var validator = (IValidator)(typeof(T) == typeof(SitePostDto) ? new SitePostValidator() : new SitePatchValidator());
        var result = validator.Validate(new ValidationContext<T>(JsonSerializer.Deserialize<T>(body, Json)!));
        return result.IsValid ? null : FieldPath.FromProperty(result.Errors[0].PropertyName);
    }

    [Theory]
    [InlineData("""{"name":"Atelier","slug":"atelier"}""")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"language":"nl-BE","description":""}}""")]
    [InlineData("""{"name":"  A  ","slug":" abc "}""")]
    public void A_valid_post_passes_AC5(string body) => Assert.Null(FailingField<SitePostDto>(body));

    [Theory]
    [InlineData("""{"slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A"}""", "/slug")]
    [InlineData("""{"name":"   ","slug":"abc"}""", "/name")]
    [InlineData("""{"name":"A","slug":"ab"}""", "/slug")]
    [InlineData("""{"name":"A","slug":"-abc"}""", "/slug")]
    [InlineData("""{"name":"A","slug":"Abc"}""", "/slug")]
    [InlineData("""{"name":"A","slug":"abc","settings":{"language":"en_US"}}""", "/settings/language")]
    public void An_invalid_post_names_the_field_AC5_AC6(string body, string field) =>
        Assert.Equal(field, FailingField<SitePostDto>(body));

    [Fact]
    public void Lengths_count_code_points_and_limits_are_inclusive_AC4_AC6()
    {
        var emoji = "\U0001F600";
        string Name(int n) => $$"""{"name":"{{string.Concat(Enumerable.Repeat(emoji, n))}}","slug":"abc"}""";
        string Description(int n) => $$$"""{"name":"A","slug":"abc","settings":{"description":"{{{new string('d', n)}}}"}}""";

        Assert.Null(FailingField<SitePostDto>(Name(80)));
        Assert.Equal("/name", FailingField<SitePostDto>(Name(81)));
        Assert.Null(FailingField<SitePostDto>(Description(160)));
        Assert.Equal("/settings/description", FailingField<SitePostDto>(Description(161)));
        Assert.Equal("/slug", FailingField<SitePostDto>($$"""{"name":"A","slug":"{{new string('s', 41)}}"}"""));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"settings":{}}""")]
    [InlineData("""{"settings":{"description":""}}""")]
    public void A_patch_needs_no_field_AC20(string body) => Assert.Null(FailingField<SitePatchDto>(body));

    [Theory]
    [InlineData("""{"name":""}""", "/name")]
    [InlineData("""{"slug":"AB"}""", "/slug")]
    [InlineData("""{"settings":{"language":"x"}}""", "/settings/language")]
    public void An_invalid_patch_names_the_field_AC21(string body, string field) =>
        Assert.Equal(field, FailingField<SitePatchDto>(body));

    [Fact]
    public void Strings_arrive_trimmed_AC4()
    {
        var dto = JsonSerializer.Deserialize<SitePostDto>("""{"name":"  Atelier ","settings":{"description":"\n hi \t"}}""", Json)!;

        Assert.Equal("Atelier", dto.Name);
        Assert.Equal("hi", dto.Settings!.Description);
    }
}

using System.Text.Json;
using FluentValidation;
using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

/// <summary>Body rules without a database: AC4, AC5, AC6 and AC21.</summary>
[TestClass]
public sealed class SiteValidatorTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    /// <summary>The field of the first failure, or null when the body is valid.</summary>
    private static string? FailingField<T>(string body)
        where T : SiteInputDto
    {
        var validator = (IValidator)(typeof(T) == typeof(SitePostDto) ? new SitePostValidator() : new SitePatchValidator());
        var result = validator.Validate(new ValidationContext<T>(JsonSerializer.Deserialize<T>(body, Json)!));
        return result.IsValid ? null : "/" + string.Join('/', result.Errors[0].PropertyName.Split('.').Select(Json.PropertyNamingPolicy!.ConvertName));
    }

    [TestMethod]
    [DataRow("""{"name":"Atelier","slug":"atelier"}""")]
    [DataRow("""{"name":"A","slug":"abc","settings":{"language":"nl-BE","description":""}}""")]
    [DataRow("""{"name":"  A  ","slug":" abc "}""")]
    public void A_valid_post_passes_AC5(string body) => Assert.IsNull(FailingField<SitePostDto>(body));

    [TestMethod]
    [DataRow("""{"slug":"abc"}""", "/name")]
    [DataRow("""{"name":"A"}""", "/slug")]
    [DataRow("""{"name":"   ","slug":"abc"}""", "/name")]
    [DataRow("""{"name":"A","slug":"ab"}""", "/slug")]
    [DataRow("""{"name":"A","slug":"-abc"}""", "/slug")]
    [DataRow("""{"name":"A","slug":"Abc"}""", "/slug")]
    [DataRow("""{"name":"A","slug":"abc","settings":{"language":"en_US"}}""", "/settings/language")]
    public void An_invalid_post_names_the_field_AC5_AC6(string body, string field) =>
        Assert.AreEqual(field, FailingField<SitePostDto>(body));

    [TestMethod]
    public void Lengths_count_code_points_and_limits_are_inclusive_AC4_AC6()
    {
        var emoji = "\U0001F600";
        string Name(int n) => $$"""{"name":"{{string.Concat(Enumerable.Repeat(emoji, n))}}","slug":"abc"}""";
        string Description(int n) => $$$"""{"name":"A","slug":"abc","settings":{"description":"{{{new string('d', n)}}}"}}""";

        Assert.IsNull(FailingField<SitePostDto>(Name(80)));
        Assert.AreEqual("/name", FailingField<SitePostDto>(Name(81)));
        Assert.IsNull(FailingField<SitePostDto>(Description(160)));
        Assert.AreEqual("/settings/description", FailingField<SitePostDto>(Description(161)));
        Assert.AreEqual("/slug", FailingField<SitePostDto>($$"""{"name":"A","slug":"{{new string('s', 41)}}"}"""));
    }

    [TestMethod]
    [DataRow("{}")]
    [DataRow("""{"settings":{}}""")]
    [DataRow("""{"settings":{"description":""}}""")]
    public void A_patch_needs_no_field_AC20(string body) => Assert.IsNull(FailingField<SitePatchDto>(body));

    [TestMethod]
    [DataRow("""{"name":""}""", "/name")]
    [DataRow("""{"slug":"AB"}""", "/slug")]
    [DataRow("""{"settings":{"language":"x"}}""", "/settings/language")]
    public void An_invalid_patch_names_the_field_AC21(string body, string field) =>
        Assert.AreEqual(field, FailingField<SitePatchDto>(body));

    [TestMethod]
    public void Strings_arrive_trimmed_AC4()
    {
        var dto = JsonSerializer.Deserialize<SitePostDto>("""{"name":"  Atelier ","settings":{"description":"\n hi \t"}}""", Json)!;

        Assert.AreEqual("Atelier", dto.Name);
        Assert.AreEqual("hi", dto.Settings!.Description);
    }
}

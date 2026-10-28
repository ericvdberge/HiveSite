using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

public sealed class IdempotencyKeyTests
{
    [Theory]
    [InlineData("", false)]
    [InlineData("a", true)]
    [InlineData("with space ~!", true)]
    [InlineData("tab\t", false)]
    [InlineData("sléutel", false)]
    public void Keys_are_printable_ASCII_AC10(string key, bool valid) =>
        Assert.Equal(valid, SiteEndpoints.IsValidKey(key));

    [Fact]
    public void Keys_are_at_most_255_characters_AC10()
    {
        Assert.True(SiteEndpoints.IsValidKey(new string('k', 255)));
        Assert.False(SiteEndpoints.IsValidKey(new string('k', 256)));
    }
}

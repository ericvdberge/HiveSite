namespace Hivesite.Content.Domain;

/// <summary>
/// The theme keys a site can pick (API-001, API-010). Content's own copy: <c>SiteThemeTokensTests</c> checks it against
/// <c>design/tokens.json</c>, so a key added on one side only fails the build.
/// </summary>
public static class SiteThemes
{
    public const string Atelier = "atelier";
    public const string Ivory = "ivory";
    public const string Studio = "studio";
    public const string Default = Atelier;

    public static IReadOnlyList<string> Keys { get; } = [Atelier, Ivory, Studio];
}

using System.ComponentModel;
using Hivesite.Content.Domain;

namespace Hivesite.Content.Endpoints;

/// <summary>The site body of every response (API-001).</summary>
public sealed record SiteDto(Guid Id, string Name, string Slug, SiteSettingsDto Settings, DateTime CreatedAt, DateTime UpdatedAt);

public sealed record SiteSettingsDto(string Language, string Description,
    [property: Description("The theme Rendering publishes the site with: atelier, ivory or studio.")]
    [property: DefaultValue(SiteThemes.Default)]
    string Theme);

/// <summary>The fields a client sends. A null member was not sent. Strings arrive trimmed, as the spec stores them.</summary>
public abstract record SiteInputDto
{
    public string? Name { get; init => field = value?.Trim(); }

    public string? Slug { get; init => field = value?.Trim(); }

    public SiteSettingsInputDto? Settings { get; init; }
}

public sealed record SiteSettingsInputDto
{
    public string? Language { get; init => field = value?.Trim(); }

    public string? Description { get; init => field = value?.Trim(); }

    [Description("One of atelier, ivory or studio. Default atelier. Any other value, including an empty string, is 400 `invalid_request` with field `/settings/theme`.")]
    public string? Theme { get; init => field = value?.Trim(); }
}

/// <summary>POST /sites.</summary>
public sealed record SitePostDto : SiteInputDto;

/// <summary>PATCH /sites/{id}: only the fields sent change.</summary>
public sealed record SitePatchDto : SiteInputDto;

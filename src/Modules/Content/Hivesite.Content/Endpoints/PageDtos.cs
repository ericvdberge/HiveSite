namespace Hivesite.Content.Endpoints;

/// <summary>The page body of every response (API-002).</summary>
public sealed record PageDto(Guid Id, Guid SiteId, string Title, string Slug, int MenuOrder, DateTime CreatedAt, DateTime UpdatedAt);

/// <summary>The fields a client sends. A null member was not sent. Strings arrive trimmed, as the spec stores them.</summary>
public abstract record PageInputDto
{
    public string? Title { get; init => field = value?.Trim(); }

    public string? Slug { get; init => field = value?.Trim(); }
}

/// <summary>POST /sites/{id}/pages.</summary>
public sealed record PagePostDto : PageInputDto;

/// <summary>PATCH /pages/{id}: only the fields sent change.</summary>
public sealed record PagePatchDto : PageInputDto;

/// <summary>PUT /sites/{id}/menu.</summary>
public sealed record MenuPutDto
{
    public List<Guid>? PageIds { get; init; }
}

/// <summary>The menu body of the PUT response: the page ids in order.</summary>
public sealed record MenuDto(Guid SiteId, IReadOnlyList<Guid> PageIds);

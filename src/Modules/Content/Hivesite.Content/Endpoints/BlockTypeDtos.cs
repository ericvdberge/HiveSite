using System.Text.Json;

namespace Hivesite.Content.Endpoints;

/// <summary>The block type body of the list response (API-003).</summary>
public sealed record BlockTypeDto(string Type, string Name, string Description, int Version, JsonElement Schema);

/// <summary>
/// <c>?limit=&amp;cursor=</c> of GET /block-types. The cursor is a block type's <c>type</c>, not an id,
/// so the shared <c>PageQuery</c> does not fit.
/// </summary>
public sealed record BlockTypeQuery(int Limit = 20, string? Cursor = null);

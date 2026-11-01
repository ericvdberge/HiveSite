using System.Text.Json;

namespace Hivesite.Content.Domain;

/// <summary>One of the fixed block types (API-003). <c>Schema</c> is the complete JSON Schema of a whole node.</summary>
public sealed record BlockType(string Type, string Name, string Description, int Version, JsonElement Schema);

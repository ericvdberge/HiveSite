using System.Text.Json;

namespace Hivesite.Content.Endpoints;

/// <summary>
/// The shape of the blocks document (API-004) for the OpenAPI document only: the handlers read and write the raw JSON, because the nodes
/// are open Tiptap JSON checked against the schemas of API-003 (<c>GET /block-types</c>), not against a DTO.
/// </summary>
public sealed record PageBlocksDocumentDto(string Type, IReadOnlyList<JsonElement> Content);

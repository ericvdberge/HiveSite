using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Hivesite.Content.Endpoints;

/// <summary>
/// The raw body and headers of a write to <c>/pages/{id}/blocks</c> (API-004). The blocks are an open Tiptap document, not a DTO, so the
/// strict binding of <c>AddSharedServices</c> does not apply. Checks the size (413), the media type (415) and <c>If-Match</c> (400 or 412),
/// in that order, before the page is looked up. A body that is not JSON becomes a null <see cref="Document"/>, which the validator refuses
/// in its place in the order, after the version check.
/// </summary>
internal sealed record PageBlocksRequest(JsonNode? Document, int? ExpectedVersion, JsonHttpResult<ApiError>? Rejection)
{
    public const int MaxBodyBytes = 262_144;

    public static async Task<PageBlocksRequest> ReadAsync(HttpRequest request, string mediaType, CancellationToken ct)
    {
        if (request.ContentLength > MaxBodyBytes || await ReadLimitedAsync(request.Body, ct) is not { } bytes)
        {
            return Reject(413, "request_too_large", $"The body can be at most {MaxBodyBytes} bytes.");
        }
        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var parsed) || !string.Equals(parsed.MediaType, mediaType, StringComparison.OrdinalIgnoreCase))
        {
            return Reject(415, "unsupported_media_type", $"The Content-Type must be {mediaType}.", "Content-Type");
        }
        var values = request.Headers.IfMatch.SelectMany(v => v!.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)).ToList();
        if (values.Count > 1 || values is ["*"])
        {
            return Reject(400, "invalid_request", "If-Match must hold exactly one ETag.", "If-Match");
        }
        int? expected = null;
        if (values.Count == 1)
        {
            if (!TryParseVersion(values[0], out var version))
            {
                return Reject(412, "precondition_failed", "If-Match is not the ETag of the current blocks.", "If-Match");
            }
            expected = version;
        }

        return new PageBlocksRequest(Parse(bytes), expected, null);
    }

    /// <summary>The ETag of a version: the integer in quotes, a strong ETag.</summary>
    public static string ETag(int version) => $"\"{version}\"";

    /// <summary>Only a quoted integer matches; a weak ETag (<c>W/"7"</c>) or anything else never does.</summary>
    private static bool TryParseVersion(string etag, out int version)
    {
        version = 0;
        return etag.Length > 2 && etag[0] == '"' && etag[^1] == '"'
            && int.TryParse(etag[1..^1], NumberStyles.None, CultureInfo.InvariantCulture, out version);
    }

    /// <summary>All of the body, or null when it is longer than <see cref="MaxBodyBytes"/>. Never reads more than one byte past the limit.</summary>
    private static async Task<byte[]?> ReadLimitedAsync(Stream body, CancellationToken ct)
    {
        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int read;
        while ((read = await body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxBodyBytes)
            {
                return null;
            }
            buffer.Write(chunk, 0, read);
        }
        return buffer.ToArray();
    }

    private static JsonNode? Parse(byte[] bytes)
    {
        try
        {
            return JsonNode.Parse(bytes, documentOptions: new JsonDocumentOptions { AllowDuplicateProperties = false });
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException)
        {
            return null;   // not JSON; a name used twice and a nesting over 64 levels land here too
        }
    }

    private static PageBlocksRequest Reject(int status, string code, string message, string? field = null) =>
        new(null, null, TypedResults.Json(ApiError.Of(code, message, field), statusCode: status));
}

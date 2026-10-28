using System.Globalization;
using System.Text.Json.Nodes;
using Hivesite.Content.Application;

namespace Hivesite.Content.Endpoints;

internal static class SiteEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        var sites = endpoints.MapGroup("/sites").AddEndpointFilter(Http.RequireOwner);

        sites.MapPost("", async (HttpContext http, SiteService service, CancellationToken ct) =>
        {
            var key = ReadKey(http, out var keyError);
            if (keyError is not null)
            {
                return keyError;
            }
            using var body = await Http.ReadObjectAsync(http.Request, ct);
            if (body is null)
            {
                return Http.Invalid("The body must be a JSON object.");
            }
            var (input, error) = SiteInputParser.Parse(body.Element(), isCreate: true);
            if (error is not null)
            {
                return Http.Invalid(error.Message, error.Field);
            }
            var hash = JsonNode.Parse(body.Element().GetRawText())!.ToJsonString();
            return await service.CreateAsync(http.Owner(), input!, key, hash, ct);
        });

        sites.MapGet("", async (HttpContext http, SiteService service, CancellationToken ct) =>
        {
            var limit = 20;
            if (http.Request.Query.TryGetValue("limit", out var raw)
                && (!int.TryParse(raw.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out limit) || limit is < 1 or > 100))
            {
                return Http.Invalid("'limit' must be an integer from 1 to 100.", "limit");
            }
            var cursor = http.Request.Query.TryGetValue("cursor", out var c) ? c.ToString() : null;
            return await service.ListAsync(http.Owner(), limit, cursor, ct);
        });

        sites.MapGet("{id}", async (string id, HttpContext http, SiteService service, CancellationToken ct) =>
            Http.TryParseId(id, out var siteId) ? await service.GetAsync(http.Owner(), siteId, ct) : Http.SiteNotFound());

        sites.MapPatch("{id}", async (string id, HttpContext http, SiteService service, CancellationToken ct) =>
        {
            if (!Http.TryParseId(id, out var siteId))
            {
                return Http.SiteNotFound();
            }
            using var body = await Http.ReadObjectAsync(http.Request, ct);
            if (body is null)
            {
                return Http.Invalid("The body must be a JSON object.");
            }
            var (input, error) = SiteInputParser.Parse(body.Element(), isCreate: false);
            return error is not null
                ? Http.Invalid(error.Message, error.Field)
                : await service.UpdateAsync(http.Owner(), siteId, input!, ct);
        });
    }

    private static System.Text.Json.JsonElement Element(this System.Text.Json.JsonDocument document) => document.RootElement;

    /// <summary>1 to 255 printable ASCII characters, or absent.</summary>
    private static string? ReadKey(HttpContext http, out IResult? error)
    {
        error = null;
        if (!http.Request.Headers.TryGetValue("Idempotency-Key", out var values))
        {
            return null;
        }
        var key = values.ToString();
        if (values.Count != 1 || key.Length is < 1 or > 255 || key.Any(ch => ch is < ' ' or > '~'))
        {
            error = Http.Invalid("'Idempotency-Key' must be 1 to 255 printable ASCII characters.", "Idempotency-Key");
        }
        return key;
    }
}

using System.Text.Json;
using Hivesite.Shared;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Endpoints;

/// <summary>Resolves the current owner id, or none. Authentication itself is out of scope (API-001 Decisions).</summary>
public interface IOwnerResolver
{
    string? Resolve(HttpContext context);
}

/// <summary>Production default until the auth spec exists: nobody is an owner, so every endpoint answers 401.</summary>
internal sealed class NoOwnerResolver : IOwnerResolver
{
    public string? Resolve(HttpContext context) => null;
}

/// <summary>Shared HTTP plumbing for the Content endpoints (API-001 Shared conventions).</summary>
internal static class Http
{
    private const string OwnerItem = "content.owner";

    public static IResult Error(int status, string code, string message, string? field = null) =>
        Results.Json(ApiError.Of(code, message, field), statusCode: status);

    public static IResult Invalid(string message, string? field = null) => Error(400, "invalid_request", message, field);

    public static IResult SiteNotFound() => Error(404, "site_not_found", "No site with this id.");

    /// <summary>Endpoint filter: no owner means 401 before anything else is looked at.</summary>
    public static async ValueTask<object?> RequireOwner(EndpointFilterInvocationContext invocation, EndpointFilterDelegate next)
    {
        var context = invocation.HttpContext;
        var owner = context.RequestServices.GetRequiredService<IOwnerResolver>().Resolve(context);
        if (string.IsNullOrEmpty(owner))
        {
            return Error(401, "unauthenticated", "Sign in as an owner to use this endpoint.");
        }
        context.Items[OwnerItem] = owner;
        return await next(invocation);
    }

    public static string Owner(this HttpContext context) => (string)context.Items[OwnerItem]!;

    /// <summary>Ids are accepted in any letter case, only in canonical 8-4-4-4-12 form. Anything else is a missing resource.</summary>
    public static bool TryParseId(string? raw, out Guid id) => Guid.TryParseExact(raw, "D", out id);

    /// <summary>Length in Unicode code points, as the spec counts.</summary>
    public static int CodePoints(string value) => value.EnumerateRunes().Count();

    public static string Pointer(params string[] segments) =>
        string.Concat(segments.Select(s => "/" + s.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal)));

    /// <summary>Reads a JSON object body; null when it is not JSON or not an object.</summary>
    public static async Task<JsonDocument?> ReadObjectAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var document = await JsonDocument.ParseAsync(request.Body, cancellationToken: cancellationToken);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                return document;
            }
            document.Dispose();
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

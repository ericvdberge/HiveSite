using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Shared;

/// <summary>The owner making the request, or null. Sign-in is out of scope (API-001 Decisions).</summary>
public interface ICurrentOwner
{
    string? Id { get; }
}

/// <summary>Production default until the auth spec exists: nobody is an owner, so every owner endpoint answers 401.</summary>
internal sealed class NoCurrentOwner : ICurrentOwner
{
    public string? Id => null;
}

public static class CurrentOwnerExtensions
{
    /// <summary>401 <c>unauthenticated</c> before anything else when there is no current owner.</summary>
    public static RouteGroupBuilder RequireOwner(this RouteGroupBuilder group) =>
        group.AddEndpointFilter(async (context, next) =>
            context.HttpContext.RequestServices.GetRequiredService<ICurrentOwner>().Id is null
                ? Results.Json(ApiError.Of("unauthenticated", "Sign in as an owner to use this endpoint."), statusCode: 401)
                : await next(context));

    /// <summary>The owner id in code behind <see cref="RequireOwner"/>.</summary>
    public static string RequiredId(this ICurrentOwner owner) =>
        owner.Id ?? throw new InvalidOperationException("No current owner; map the endpoint with RequireOwner().");
}

using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Hivesite.Shared;

/// <summary>The signed-in user of this request. Endpoints that need one call <c>RequireAuthorization()</c>.</summary>
public sealed class UserContext(IHttpContextAccessor http)
{
    public string Id =>
        http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("No signed-in user; map the endpoint with RequireAuthorization().");
}

/// <summary>
/// Sign-in is out of scope (API-001 Decisions), so nobody is authenticated yet and every endpoint behind
/// <c>RequireAuthorization()</c> answers 401 <c>unauthenticated</c>. A real scheme replaces <see cref="HandleAuthenticateAsync"/>.
/// </summary>
public class UserAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync() => Task.FromResult(AuthenticateResult.NoResult());

    protected override Task HandleChallengeAsync(AuthenticationProperties properties) =>
        Results.Json(ApiError.Of("unauthenticated", "Sign in as an owner to use this endpoint."), statusCode: 401).ExecuteAsync(Context);
}

using System.Security.Claims;
using System.Text.Encodings.Web;
using Hivesite.Content;
using Hivesite.Shared;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Hivesite.Host;

/// <summary>
/// Development only (ADR 4, #118): every request is signed in as the seeded admin, and the database is migrated and seeded
/// at startup, so a fresh clone runs the studio. Outside Development nothing here is registered and sign-in stays a 401.
/// </summary>
public static class DevelopmentHost
{
    public static IServiceCollection AddDevelopmentHost(this IServiceCollection services, IHostEnvironment environment)
    {
        if (!environment.IsDevelopment())
        {
            return services;
        }
        services.AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(DevelopmentAuthenticationHandler.SchemeName, null);
        services.AddHostedService<DevelopmentDatabase>();
        return services;
    }
}

/// <summary>Signs every request in as <see cref="ContentModule.DevelopmentOwnerId"/>. Registered in Development only.</summary>
public sealed class DevelopmentAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
    : UserAuthenticationHandler(options, logger, encoder)
{
    public new const string SchemeName = "DevelopmentUser";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, ContentModule.DevelopmentOwnerId)], Scheme.Name));
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(user, Scheme.Name)));
    }
}

/// <summary>
/// Applies every module's migrations before the Host takes requests (only Content has them so far), then runs the Content
/// seed when <c>Dev:Seed</c> is true. Registered in Development only.
/// </summary>
public sealed class DevelopmentDatabase(IServiceProvider services, IConfiguration configuration) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await services.MigrateContentDatabaseAsync(cancellationToken);
        if (configuration.GetValue<bool>("Dev:Seed"))
        {
            await services.SeedContentDevelopmentDataAsync(cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

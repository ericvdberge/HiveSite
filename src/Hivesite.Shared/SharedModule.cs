using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Hivesite.Shared;

/// <summary>What every module relies on. The Host calls it once, before the modules.</summary>
public static class SharedModule
{
    public static IServiceCollection AddSharedServices(this IServiceCollection services)
    {
        // Strict bodies (specs/STYLE.md): snake_case, and an unknown field is a 400, not ignored.
        services.ConfigureHttpJsonOptions(o =>
        {
            o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
            o.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        });
        // Bad JSON throws, so ApiExceptionHandler can answer it in our error shape.
        services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddProblemDetails();

        services.AddValidatorsFromAssemblyContaining<PageQueryValidator>();

        services.AddAuthentication(UserAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, UserAuthenticationHandler>(UserAuthenticationHandler.SchemeName, null);
        services.AddAuthorization();
        services.AddHttpContextAccessor();
        services.TryAddScoped<UserContext>();

        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<ITimeService, TimeService>();
        return services;
    }
}

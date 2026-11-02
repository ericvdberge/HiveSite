namespace Hivesite.Host;

/// <summary>Lets the studio, served from its own origin, call the API from the browser.</summary>
public static class StudioCors
{
    public const string Policy = "Studio";

    /// <summary>
    /// Allows the origins in <c>Studio:Origins</c>, with credentials. None configured means no
    /// cross-origin calls at all; a <c>*</c> fails at startup, since credentials forbid a wildcard.
    /// </summary>
    public static IServiceCollection AddStudioCors(this IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Studio:Origins").Get<string[]>() ?? [];
        return services.AddCors(options => options.AddPolicy(Policy, policy => policy
            .WithOrigins(origins)
            .AllowCredentials()
            .AllowAnyHeader()
            .AllowAnyMethod()
            // The studio sends If-Match with the version it read (API-004); a browser only lets it read ETag if it is exposed.
            .WithExposedHeaders("ETag")));
    }
}

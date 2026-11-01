using FluentValidation;
using Hivesite.Content.Application;
using Hivesite.Content.Endpoints;
using Hivesite.Content.Infrastructure;
using Hivesite.Content.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Hivesite.Content;

/// <summary>Wires the Content module into the host. Connection string: <c>ConnectionStrings:Content</c>.</summary>
public static class ContentModule
{
    public static IServiceCollection AddContentModule(this IServiceCollection services)
    {
        services.AddDbContext<ContentDbContext>((sp, options) =>
            Configure(options, sp.GetRequiredService<IConfiguration>().GetConnectionString("Content")));
        services.AddValidatorsFromAssemblyContaining<ContentDbContext>(includeInternalTypes: true);

        services.AddScoped<SiteRepository>();
        services.AddScoped<SiteService>();
        services.AddScoped<PageRepository>();
        services.AddScoped<PageService>();
        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapSiteEndpoints();
        endpoints.MapPageEndpoints();
        return endpoints;
    }

    /// <summary>Creates or updates the <c>content</c> schema. The Host or a deploy step calls it.</summary>
    public static async Task MigrateContentDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync(cancellationToken);
    }

    /// <summary>
    /// Seeds sample sites and pages for local work, only when the environment is Development; otherwise it writes nothing.
    /// Run it on demand after <see cref="MigrateContentDatabaseAsync"/>. It never runs at startup. Safe to repeat.
    /// </summary>
    public static async Task SeedContentDevelopmentDataAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        if (!services.GetRequiredService<IHostEnvironment>().IsDevelopment())
        {
            return;
        }
        await new DevSeeder(services).RunAsync(cancellationToken);
    }

    internal static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string? connectionString) =>
        options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__efMigrationsHistory", ContentDbContext.Schema))
            .UseCamelCaseNamingConvention();
}

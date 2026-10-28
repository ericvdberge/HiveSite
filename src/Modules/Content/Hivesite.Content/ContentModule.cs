using FluentValidation;
using Hivesite.Content.Application;
using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;
using Hivesite.Content.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content;

/// <summary>Wires the Content module into the host. Connection string: <c>ConnectionStrings:Content</c>.</summary>
public static class ContentModule
{
    public static IServiceCollection AddContentModule(this IServiceCollection services)
    {
        services.AddDbContext<ContentDbContext>((sp, options) =>
            Configure(options, sp.GetRequiredService<IConfiguration>().GetConnectionString("Content")));
        services.AddValidatorsFromAssemblyContaining<ContentDbContext>(includeInternalTypes: true);

        services.AddEntity<Site, SiteDao, SiteDaoMapper>();
        services.AddScoped<SiteService>();
        return services;
    }

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapSiteEndpoints();
        return endpoints;
    }

    /// <summary>Creates or updates the <c>content</c> schema. The Host or a deploy step calls it.</summary>
    public static async Task MigrateContentDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ContentDbContext>().Database.MigrateAsync(cancellationToken);
    }

    internal static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string? connectionString) =>
        options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", ContentDbContext.Schema));

    /// <summary>One line per entity: its DAO mapper and the generic repository.</summary>
    private static void AddEntity<TEntity, TDao, TMapper>(this IServiceCollection services)
        where TEntity : class, Shared.IEntity
        where TDao : class, Shared.IEntity
        where TMapper : class, IDaoMapper<TEntity, TDao>
    {
        services.AddSingleton<IDaoMapper<TEntity, TDao>, TMapper>();
        services.AddScoped<IRepository<TEntity>, Repository<TEntity, TDao>>();
    }
}

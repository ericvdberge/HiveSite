using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hivesite.Content.Infrastructure;

/// <summary>The Content module's database, schema <c>content</c> (ADR 2). Tables and columns are snake_case.</summary>
public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string Schema = "content";

    public DbSet<SiteDao> Sites => Set<SiteDao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ContentDbContext).Assembly);
        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetProperties()))
        {
            property.SetColumnName(JsonNamingPolicy.SnakeCaseLower.ConvertName(property.Name));
        }
    }
}

/// <summary>Lets <c>dotnet ef migrations</c> build the context without a running host.</summary>
internal sealed class ContentDbContextFactory : IDesignTimeDbContextFactory<ContentDbContext>
{
    public ContentDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<ContentDbContext>();
        ContentModule.Configure(builder, "Host=localhost;Database=hivesite");
        return new ContentDbContext(builder.Options);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hivesite.Content.Infrastructure;

/// <summary>The Content module's database, schema <c>content</c> (ADR 2). Tables and columns are snake_case (<see cref="ContentModule.Configure"/>).</summary>
public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string Schema = "content";
    public const string SiteSlugIndex = "ix_sites_slug";

    public DbSet<SiteDao> Sites => Set<SiteDao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<SiteDao>(site =>
        {
            site.ToTable("sites");
            site.Property(s => s.Id).ValueGeneratedNever();
            site.Property(s => s.Slug).HasMaxLength(40);
            site.HasIndex(s => s.Slug).IsUnique().HasDatabaseName(SiteSlugIndex);
            // Serves GET /sites: one owner, newest first, ties by id ascending.
            site.HasIndex(s => new { s.OwnerId, s.CreatedAt, s.Id })
                .IsDescending(false, true, false)
                .HasDatabaseName("ix_sites_owner_created_at_id");
        });
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

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hivesite.Content.Infrastructure;

/// <summary>The Content module's database, schema <c>content</c> (ADR 2). Tables, columns and keys are camelCase (<see cref="ContentModule.Configure"/>).</summary>
public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string Schema = "content";
    public const string SiteSlugIndex = "ixSitesSlug";
    public const string PageSlugIndex = "ixPagesSiteIdSlug";

    public DbSet<SiteDao> Sites => Set<SiteDao>();

    public DbSet<PageDao> Pages => Set<PageDao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<SiteDao>(site =>
        {
            site.ToTable("sites");
            site.HasKey(s => s.Id).HasName("pkSites");
            site.Property(s => s.Id).ValueGeneratedNever();
            site.Property(s => s.Slug).HasMaxLength(40);
            site.HasIndex(s => s.Slug).IsUnique().HasDatabaseName(SiteSlugIndex);
            // Serves GET /sites: one owner, newest first, ties by id ascending.
            site.HasIndex(s => new { s.OwnerId, s.CreatedAt, s.Id })
                .IsDescending(false, true, false)
                .HasDatabaseName("ixSitesOwnerIdCreatedAtId");
        });

        modelBuilder.Entity<PageDao>(page =>
        {
            page.ToTable("pages");
            page.HasKey(p => p.Id).HasName("pkPages");
            page.Property(p => p.Id).ValueGeneratedNever();
            page.Property(p => p.Title).HasMaxLength(320); // 80 code points, up to 4 UTF-16 chars each
            page.Property(p => p.Slug).HasMaxLength(60);
            page.HasOne<SiteDao>().WithMany().HasForeignKey(p => p.SiteId).HasConstraintName("fkPagesSiteId");
            page.HasIndex(p => new { p.SiteId, p.Slug }).IsUnique().HasDatabaseName(PageSlugIndex);
            // Serves GET /sites/{id}/pages. Not unique: a menu change moves several orders at once.
            page.HasIndex(p => new { p.SiteId, p.MenuOrder }).HasDatabaseName("ixPagesSiteIdMenuOrder");
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

using Hivesite.Content.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hivesite.Content.Infrastructure;

/// <summary>A stored successful POST, kept 24 hours so a repeat with the same Idempotency-Key replays it.</summary>
public sealed class IdempotencyRecord
{
    public required string OwnerId { get; set; }
    public required string Key { get; set; }
    public required string RequestHash { get; set; }
    public required string ResponseBody { get; set; }
    public required string Location { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>The Content module's database, schema <c>content</c> (ADR 2).</summary>
public sealed class ContentDbContext(DbContextOptions<ContentDbContext> options) : DbContext(options)
{
    public const string Schema = "content";
    public const string SlugIndex = "ix_sites_slug";

    public DbSet<Site> Sites => Set<Site>();
    public DbSet<IdempotencyRecord> IdempotencyKeys => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);

        modelBuilder.Entity<Site>(site =>
        {
            site.ToTable("sites");
            site.HasKey(s => s.Id);
            site.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
            site.Property(s => s.OwnerId).HasColumnName("owner_id");
            site.Property(s => s.Name).HasColumnName("name");
            site.Property(s => s.Slug).HasColumnName("slug").HasMaxLength(40);
            site.Property(s => s.Language).HasColumnName("language");
            site.Property(s => s.Description).HasColumnName("description");
            site.Property(s => s.CreatedAt).HasColumnName("created_at");
            site.Property(s => s.UpdatedAt).HasColumnName("updated_at");
            site.HasIndex(s => s.Slug).IsUnique().HasDatabaseName(SlugIndex);
            // Serves GET /sites: one owner, newest first, ties by id ascending.
            site.HasIndex(s => new { s.OwnerId, s.CreatedAt, s.Id })
                .IsDescending(false, true, false)
                .HasDatabaseName("ix_sites_owner_created_at_id");
        });

        modelBuilder.Entity<IdempotencyRecord>(record =>
        {
            record.ToTable("idempotency_keys");
            record.HasKey(r => new { r.OwnerId, r.Key });
            record.Property(r => r.OwnerId).HasColumnName("owner_id");
            record.Property(r => r.Key).HasColumnName("key").HasMaxLength(255);
            record.Property(r => r.RequestHash).HasColumnName("request_hash");
            record.Property(r => r.ResponseBody).HasColumnName("response_body");
            record.Property(r => r.Location).HasColumnName("location");
            record.Property(r => r.CreatedAt).HasColumnName("created_at");
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

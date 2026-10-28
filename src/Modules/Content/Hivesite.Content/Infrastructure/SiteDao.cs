using Hivesite.Content.Domain;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Infrastructure;

/// <summary>The <c>content.sites</c> row.</summary>
public sealed class SiteDao : IEntity, IAuditable
{
    public const string SlugIndex = "ix_sites_slug";

    public Guid Id { get; set; }

    public required string OwnerId { get; set; }

    public required string Name { get; set; }

    public required string Slug { get; set; }

    public required string Language { get; set; }

    public required string Description { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

internal sealed class SiteDaoConfiguration : IEntityTypeConfiguration<SiteDao>
{
    public void Configure(EntityTypeBuilder<SiteDao> site)
    {
        site.ToTable("sites");
        site.Property(s => s.Id).ValueGeneratedNever();
        site.Property(s => s.Slug).HasMaxLength(40);
        site.HasIndex(s => s.Slug).IsUnique().HasDatabaseName(SiteDao.SlugIndex);
        // Serves GET /sites: one owner, newest first, ties by id ascending.
        site.HasIndex(s => new { s.OwnerId, s.CreatedAt, s.Id })
            .IsDescending(false, true, false)
            .HasDatabaseName("ix_sites_owner_created_at_id");
    }
}

[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target)]
internal sealed partial class SiteDaoMapper : IDaoMapper<Site, SiteDao>
{
    public partial SiteDao ToDao(Site entity);

    public partial Site ToEntity(SiteDao dao);

    public partial IQueryable<Site> Project(IQueryable<SiteDao> query);

    [MapperIgnoreTarget(nameof(SiteDao.Id))]
    [MapperIgnoreTarget(nameof(SiteDao.OwnerId))]
    [MapperIgnoreTarget(nameof(SiteDao.CreatedAt))]
    [MapperIgnoreTarget(nameof(SiteDao.UpdatedAt))]
    public partial void Update(Site entity, SiteDao dao);
}

using Hivesite.Content.Application;
using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Hivesite.Content.Infrastructure;

/// <summary>Maps an entity to its data access object and back. Implement it with a Mapperly <c>[Mapper]</c>.</summary>
public interface IDaoMapper<TEntity, TDao>
{
    TDao ToDao(TEntity entity);

    TEntity ToEntity(TDao dao);

    IQueryable<TEntity> Project(IQueryable<TDao> query);

    /// <summary>Copies the editable fields onto a tracked row. Ids, owners and timestamps are not editable.</summary>
    void Update(TEntity entity, TDao dao);
}

/// <summary>The one repository for every entity: register it per entity with its <see cref="IDaoMapper{TEntity, TDao}"/>.</summary>
internal sealed class Repository<TEntity, TDao>(ContentDbContext db, IDaoMapper<TEntity, TDao> mapper, ITimeService time)
    : IRepository<TEntity>
    where TEntity : class, IEntity
    where TDao : class, IEntity
{
    private DbSet<TDao> Set => db.Set<TDao>();

    public IQueryable<TEntity> Query => mapper.Project(Set.AsNoTracking());

    public async Task<TEntity> AddAsync(TEntity entity, CancellationToken cancellationToken)
    {
        var dao = mapper.ToDao(entity);
        dao.Id = Guid.CreateVersion7();
        if (dao is IAuditable audited)
        {
            audited.CreatedAt = audited.UpdatedAt = time.UtcNow;
        }
        Set.Add(dao);
        await db.SaveChangesAsync(cancellationToken);
        return mapper.ToEntity(dao);
    }

    public async Task<(TEntity Entity, bool Changed)> UpdateAsync(TEntity entity, CancellationToken cancellationToken)
    {
        var dao = await Set.FindAsync([entity.Id], cancellationToken)
            ?? throw new InvalidOperationException($"{typeof(TEntity).Name} {entity.Id} does not exist.");
        mapper.Update(entity, dao);
        if (!db.ChangeTracker.HasChanges())
        {
            return (mapper.ToEntity(dao), false);
        }
        if (dao is IAuditable audited)
        {
            audited.UpdatedAt = time.UtcNow;
        }
        await db.SaveChangesAsync(cancellationToken);
        return (mapper.ToEntity(dao), true);
    }
}

internal static class DbUpdateExceptionExtensions
{
    public static bool IsUniqueViolation(this DbUpdateException exception, string index) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } e && e.ConstraintName == index;
}

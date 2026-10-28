using Hivesite.Shared;

namespace Hivesite.Content.Application;

/// <summary>Stores one kind of entity. Services work with entities only; the data access objects stay behind this.</summary>
public interface IRepository<TEntity>
    where TEntity : class, IEntity
{
    /// <summary>Every stored entity, read-only. Services filter, order and page it.</summary>
    IQueryable<TEntity> Query { get; }

    /// <summary>Inserts with a new UUIDv7 id and timestamps, and returns the stored entity.</summary>
    Task<TEntity> AddAsync(TEntity entity, CancellationToken cancellationToken);

    /// <summary>Writes the changed fields only. <c>Changed</c> is false when nothing differed, and then nothing is written.</summary>
    Task<(TEntity Entity, bool Changed)> UpdateAsync(TEntity entity, CancellationToken cancellationToken);
}

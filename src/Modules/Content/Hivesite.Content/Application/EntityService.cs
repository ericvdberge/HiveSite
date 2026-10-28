using Hivesite.Shared;
using Microsoft.EntityFrameworkCore;

namespace Hivesite.Content.Application;

/// <summary>
/// The base of every entity service: get, create, update and page, on entities only.
/// A service narrows <see cref="Query"/> to what the caller may see and adds its own rules by overriding.
/// </summary>
public abstract class EntityService<TEntity>(IRepository<TEntity> repository)
    where TEntity : class, IEntity
{
    protected IRepository<TEntity> Repository => repository;

    /// <summary>What the caller may see. Everything else is <see cref="NotFound"/>.</summary>
    protected virtual IQueryable<TEntity> Query => repository.Query;

    protected abstract NotFoundException NotFound();

    public async Task<TEntity> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await Query.SingleOrDefaultAsync(e => e.Id == id, cancellationToken) ?? throw NotFound();

    public virtual Task<TEntity> CreateAsync(TEntity entity, CancellationToken cancellationToken) =>
        repository.AddAsync(entity, cancellationToken);

    public virtual async Task<TEntity> UpdateAsync(TEntity entity, CancellationToken cancellationToken) =>
        (await repository.UpdateAsync(entity, cancellationToken)).Entity;

    /// <summary>Reads one more row than asked to know whether another page follows.</summary>
    protected static async Task<Page<TEntity>> PageAsync(IQueryable<TEntity> ordered, int limit, CancellationToken cancellationToken)
    {
        var rows = await ordered.Take(limit + 1).ToListAsync(cancellationToken);
        return new Page<TEntity>(rows.Take(limit).ToList(), rows.Count > limit);
    }
}

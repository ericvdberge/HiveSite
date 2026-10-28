namespace Hivesite.Shared;

/// <summary>Anything stored with a UUIDv7 id. The repository sets the id on insert.</summary>
public interface IEntity
{
    Guid Id { get; set; }
}

/// <summary>Stamped by the repository from <see cref="ITimeService"/>: both on insert, <c>UpdatedAt</c> on every real change.</summary>
public interface IAuditable
{
    DateTime CreatedAt { get; set; }

    DateTime UpdatedAt { get; set; }
}

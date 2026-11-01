using Hivesite.Content.Contracts;
using Hivesite.Content.Domain;
using Riok.Mapperly.Abstractions;

namespace Hivesite.Content.Application;

/// <summary>Internal records to the contract DTOs of <see cref="IContentApi"/>.</summary>
[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target, AllowNullPropertyAssignment = false)]
internal static partial class ContentApiMapper
{
    public static partial IReadOnlyList<BlockTypeInfo> ToInfo(IReadOnlyList<BlockType> blockTypes);
}

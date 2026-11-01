using FluentValidation;

namespace Hivesite.Content.Endpoints;

internal sealed class BlockTypeQueryValidator : AbstractValidator<BlockTypeQuery>
{
    public BlockTypeQueryValidator() =>
        RuleFor(q => q.Limit).InclusiveBetween(1, 100).WithMessage("'limit' must be an integer from 1 to 100.");
}

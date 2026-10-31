using FluentValidation;
using Hivesite.Content.Application;
using Hivesite.Shared;

namespace Hivesite.Content.Endpoints;

/// <summary>The field rules of API-002, shared by POST and PATCH.</summary>
internal abstract class PageInputValidator<T> : AbstractValidator<T>
    where T : PageInputDto
{
    protected PageInputValidator()
    {
        RuleFor(x => x.Title).CodePoints(1, 80);
        RuleFor(x => x.Slug).CodePoints(1, 60).Matches("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$");
    }
}

internal sealed class PagePostValidator : PageInputValidator<PagePostDto>
{
    public PagePostValidator()
    {
        RuleFor(x => x.Title).NotNull();
        RuleFor(x => x.Slug).NotNull();
    }
}

internal sealed class PagePatchValidator : PageInputValidator<PagePatchDto>;

internal sealed class MenuPutValidator : AbstractValidator<MenuPutDto>
{
    public MenuPutValidator()
    {
        RuleFor(x => x.PageIds).NotNull();
        RuleFor(x => x.PageIds).Must(ids => ids!.Count <= PageService.MaxPagesPerSite)
            .When(x => x.PageIds is not null)
            .WithMessage($"'page_ids' can hold at most {PageService.MaxPagesPerSite} ids.");
        RuleFor(x => x.PageIds).Must(ids => ids!.Distinct().Count() == ids!.Count)
            .When(x => x.PageIds is not null)
            .WithMessage("'page_ids' lists an id more than once.");
    }
}

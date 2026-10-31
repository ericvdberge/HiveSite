using FluentValidation;
using Hivesite.Shared;

namespace Hivesite.Content.Endpoints;

/// <summary>The field rules of API-001, shared by POST and PATCH.</summary>
internal abstract class SiteInputValidator<T> : AbstractValidator<T>
    where T : SiteInputDto
{
    protected SiteInputValidator()
    {
        RuleFor(x => x.Name).CodePoints(1, 80);
        RuleFor(x => x.Slug).CodePoints(3, 40).Matches("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$");
        RuleFor(x => x.Settings).SetValidator(new SiteSettingsValidator()!);
    }
}

internal sealed class SiteSettingsValidator : AbstractValidator<SiteSettingsInputDto>
{
    public SiteSettingsValidator()
    {
        RuleFor(x => x.Language).CodePoints(2, 35).Matches("^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$");
        RuleFor(x => x.Description).CodePoints(0, 160);
    }
}

internal sealed class SitePostValidator : SiteInputValidator<SitePostDto>
{
    public SitePostValidator()
    {
        RuleFor(x => x.Name).NotNull();
        RuleFor(x => x.Slug).NotNull();
    }
}

internal sealed class SitePatchValidator : SiteInputValidator<SitePatchDto>;

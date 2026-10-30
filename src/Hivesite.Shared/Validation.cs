using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Hivesite.Shared;

/// <summary>Runs <typeparamref name="TValidator"/> on the argument it validates, before the handler. The first failure is a 400.</summary>
public sealed class ValidationFilter<TValidator>(TValidator validator) : IEndpointFilter
    where TValidator : IValidator
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var argument = context.Arguments.FirstOrDefault(a => a is not null && validator.CanValidateInstancesOfType(a.GetType()));
        if (argument is null)
        {
            return await next(context);
        }

        var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
        if (result.IsValid)
        {
            return await next(context);
        }

        // A body field is a JSON Pointer ("Settings.Language" → "/settings/language"), a query parameter its plain name ("limit").
        var failure = result.Errors[0];
        var field = string.Join('/', failure.PropertyName.Split('.').Select(JsonNamingPolicy.SnakeCaseLower.ConvertName));
        return Results.Json(ApiError.Of("invalid_request", failure.ErrorMessage, context.HttpContext.Request.HasJsonContentType() ? "/" + field : field), statusCode: 400);
    }
}

public static class ValidationExtensions
{
    /// <summary>Validates this endpoint's input with <typeparamref name="TValidator"/>.</summary>
    public static RouteHandlerBuilder Validate<TValidator>(this RouteHandlerBuilder builder)
        where TValidator : IValidator =>
        builder.AddEndpointFilter<RouteHandlerBuilder, ValidationFilter<TValidator>>();

    /// <summary>Length in Unicode code points, as the specs count. Null passes; pair with <c>NotNull()</c> when required.</summary>
    public static IRuleBuilderOptions<T, string?> CodePoints<T>(this IRuleBuilder<T, string?> rule, int min, int max) =>
        rule.Must(value => value is null || value.EnumerateRunes().Count() is var length && length >= min && length <= max)
            .WithMessage($"'{{PropertyName}}' must be {min} to {max} characters.");
}

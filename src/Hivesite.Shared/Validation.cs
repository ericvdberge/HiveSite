using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Hivesite.Shared;

/// <summary>Runs the FluentValidation validator of <typeparamref name="T"/> before the handler. The first failure is a 400.</summary>
public sealed class ValidationFilter<T>(IValidator<T> validator) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var argument = context.Arguments.OfType<T>().FirstOrDefault();
        if (argument is null)
        {
            return await next(context);
        }

        var result = await validator.ValidateAsync(argument, context.HttpContext.RequestAborted);
        if (result.IsValid)
        {
            return await next(context);
        }

        var failure = result.Errors[0];
        // A body field is a JSON Pointer ("/settings/language"), a query parameter its plain name ("limit").
        var field = context.HttpContext.Request.HasJsonContentType()
            ? FieldPath.FromProperty(failure.PropertyName)
            : JsonNamingPolicy.SnakeCaseLower.ConvertName(failure.PropertyName);
        return Results.Json(ApiError.Of("invalid_request", failure.ErrorMessage, field), statusCode: 400);
    }
}

public static class ValidationExtensions
{
    /// <summary>Validates the <typeparamref name="T"/> argument of this endpoint with its registered validator.</summary>
    public static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder builder) =>
        builder.AddEndpointFilter<RouteHandlerBuilder, ValidationFilter<T>>();

    /// <summary>Length in Unicode code points, as the specs count. Null passes; pair with <c>NotNull()</c> when required.</summary>
    public static IRuleBuilderOptions<T, string?> CodePoints<T>(this IRuleBuilder<T, string?> rule, int min, int max) =>
        rule.Must(value => value is null || value.EnumerateRunes().Count() is var length && length >= min && length <= max)
            .WithMessage($"'{{PropertyName}}' must be {min} to {max} characters.");
}

using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;

namespace Hivesite.Shared;

/// <summary>Turns what the framework throws (bad JSON, bad parameters, bugs) into the error body of specs/STYLE.md.</summary>
internal sealed class ApiExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, error) = exception switch
        {
            BadHttpRequestException { InnerException: JsonException json } => (400, InvalidJson(json)),
            BadHttpRequestException e => (e.StatusCode, ApiError.Of("invalid_request", e.Message)),
            _ => (500, ApiError.Of("internal_error", "Something went wrong on our side.")),
        };
        await Results.Json(error, statusCode: status).ExecuteAsync(context);
        return true;
    }

    /// <summary>Wrong types, null where it is not allowed and unknown fields all land here. <c>$.settings.extra</c> → <c>/settings/extra</c>.</summary>
    private static ApiError InvalidJson(JsonException json)
    {
        if (json.Path is null or "$")
        {
            return ApiError.Of("invalid_request", "The body must be a valid JSON object.");
        }
        var field = "/" + json.Path[2..].Replace('.', '/');
        return ApiError.Of("invalid_request", $"'{field}' is not allowed or has the wrong type.", field);
    }
}

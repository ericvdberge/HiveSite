using System.Text.Json;
using Hivesite.Shared;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

/// <summary>
/// The public HTTP document the studio's client is generated from, served at <c>/openapi/v1.json</c> in Development only.
/// A copy is committed at <c>openapi/hivesite.v1.json</c>; <c>tests/Hivesite.Host.Tests</c> fails when it drifts.
/// </summary>
internal static class HostOpenApi
{
    public static IServiceCollection AddHivesiteOpenApi(this IServiceCollection services) =>
        services.AddOpenApi(options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new OpenApiInfo { Title = "Hivesite API", Version = "v1" };
                document.Servers = null;   // the request's own host, which differs per machine and would make the committed copy drift
                return Task.CompletedTask;
            });
            options.AddOperationTransformer(DescribeListQuery);
            options.AddSchemaTransformer(DescribeSharedShapes);
            // PageDto<SiteDto> is "SiteDtoList", not "PageDtoOfSiteDto", which reads like a page of web pages.
            options.CreateSchemaReferenceId = info => IsPage(info.Type)
                ? OpenApiOptions.CreateDefaultSchemaReferenceId(info.Options.GetTypeInfo(info.Type.GetGenericArguments()[0])) + "List"
                : OpenApiOptions.CreateDefaultSchemaReferenceId(info);
        });

    /// <summary>
    /// Query names are snake_case like the JSON (binding ignores case, so <c>?limit=</c> is what clients send), and the
    /// <c>?limit=&amp;cursor=</c> of <see cref="PageQuery"/> is worded once for every list.
    /// </summary>
    private static Task DescribeListQuery(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        foreach (var parameter in (operation.Parameters ?? []).OfType<OpenApiParameter>().Where(p => p.In == ParameterLocation.Query))
        {
            parameter.Name = JsonNamingPolicy.SnakeCaseLower.ConvertName(parameter.Name!);
            parameter.Description = parameter.Name switch
            {
                "limit" => "How many items to return, 1 to 100.",
                "cursor" => "The `next_cursor` of the previous page. Leave out for the first page.",
                _ => parameter.Description,
            };
        }
        return Task.CompletedTask;
    }

    /// <summary>
    /// The error body and the list body of specs/STYLE.md, described where the shared types are, so every endpoint that
    /// returns them reuses one <c>ApiError</c> component and one wording of <c>{ items, next_cursor }</c>.
    /// </summary>
    private static Task DescribeSharedShapes(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;
        if (context.JsonPropertyInfo is { } property)
        {
            schema.Description = (property.DeclaringType, property.Name) switch
            {
                (var t, "code") when t == typeof(Error) => "What went wrong, in snake_case. Branch on this, never on the status alone.",
                (var t, "message") when t == typeof(Error) => "A sentence for people. It may change; do not parse it.",
                (var t, "field") when t == typeof(Error) => "The input to blame: a JSON Pointer into the body, or a query parameter or header name. Left out when no single input is to blame.",
                (var t, "items") when IsPage(t) => "This page of the list, in list order.",
                (var t, "next_cursor") when IsPage(t) => "Pass as `cursor` to get the next page; null on the last page.",
                _ => schema.Description,
            };
        }
        else if (type == typeof(ApiError))
        {
            schema.Description = "The error body every endpoint returns (specs/STYLE.md).";
        }
        else if (IsPage(type))
        {
            schema.Description = "One page of a list (specs/STYLE.md), asked for with `?limit=` and `?cursor=`.";
        }
        return Task.CompletedTask;
    }

    private static bool IsPage(Type type) => type.IsGenericType && type.GetGenericTypeDefinition() == typeof(PageDto<>);
}

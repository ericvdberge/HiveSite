using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;

namespace Hivesite.Content.Endpoints;

/// <summary>
/// The headers of API-004 in the OpenAPI document, so the studio's generated types know them: <c>ETag</c> on the 200 of GET and PUT,
/// <c>If-Match</c> on PUT. The handlers read and write them by hand (<see cref="PageBlocksRequest"/>), which the document cannot see.
/// </summary>
internal static class PageBlocksOpenApi
{
    public static IServiceCollection AddPageBlocksOpenApi(this IServiceCollection services) =>
        services.Configure<OpenApiOptions>("v1", options => options.AddOperationTransformer(DescribeHeaders));

    private static Task DescribeHeaders(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        if (operation.OperationId is not ("GetPageBlocks" or "ReplacePageBlocks"))
        {
            return Task.CompletedTask;
        }

        if (operation.Responses?["200"] is OpenApiResponse ok)
        {
            ok.Headers ??= new Dictionary<string, IOpenApiHeader>();
            ok.Headers["ETag"] = new OpenApiHeader
            {
                Description = "The version of the document, quoted, e.g. `\"3\"`. Send it back as `If-Match` on the next PUT.",
                Required = true,
                Schema = new OpenApiSchema { Type = JsonSchemaType.String },
            };
        }

        if (operation.OperationId == "ReplacePageBlocks")
        {
            operation.Parameters ??= [];
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = "If-Match",
                In = ParameterLocation.Header,
                Required = false,
                Description = "The `ETag` of the document being replaced. A stale one answers 412 `precondition_failed`. Leave out to write without the check.",
                Schema = new OpenApiSchema { Type = JsonSchemaType.String },
            });
        }
        return Task.CompletedTask;
    }
}

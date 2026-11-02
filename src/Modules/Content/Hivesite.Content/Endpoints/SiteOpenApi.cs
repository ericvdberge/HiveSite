using System.Text.Json.Nodes;
using Hivesite.Content.Domain;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;

namespace Hivesite.Content.Endpoints;

/// <summary>The OpenAPI schema of <c>settings.theme</c> (API-001): the three keys of <see cref="SiteThemes"/> as an enum, so the studio's generated types list them.</summary>
internal static class SiteOpenApi
{
    public static IServiceCollection AddSiteOpenApi(this IServiceCollection services) =>
        services.Configure<OpenApiOptions>("v1", options => options.AddSchemaTransformer(DescribeTheme));

    private static Task DescribeTheme(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (context.JsonPropertyInfo is { Name: "theme", DeclaringType: var type } && (type == typeof(SiteSettingsDto) || type == typeof(SiteSettingsInputDto)))
        {
            schema.Enum = SiteThemes.Keys.Select(key => (JsonNode)JsonValue.Create(key)!).ToList();
        }
        return Task.CompletedTask;
    }
}

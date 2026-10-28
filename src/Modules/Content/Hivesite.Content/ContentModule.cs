using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content;

/// <summary>Wires the Content module into the host.</summary>
public static class ContentModule
{
    public static IServiceCollection AddContentModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder endpoints) => endpoints;
}

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Rendering;

/// <summary>Wires the Rendering module into the host.</summary>
public static class RenderingModule
{
    public static IServiceCollection AddRenderingModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapRenderingEndpoints(this IEndpointRouteBuilder endpoints) => endpoints;
}

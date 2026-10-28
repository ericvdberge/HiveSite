using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Publishing;

/// <summary>Wires the Publishing module into the host.</summary>
public static class PublishingModule
{
    public static IServiceCollection AddPublishingModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapPublishingEndpoints(this IEndpointRouteBuilder endpoints) => endpoints;
}

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Host.Tests;

/// <summary>The Host in an environment, for tests that need no database.</summary>
internal static class HostFactory
{
    /// <summary>
    /// Without the Development startup migration and seed (<see cref="DevelopmentDatabase"/>), which needs PostgreSQL.
    /// Everything else, including the Development sign-in, stays as the environment sets it.
    /// </summary>
    public static WebApplicationFactory<Program> WithoutDatabase(string environment = "Development") =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder
            .UseEnvironment(environment)
            .ConfigureTestServices(services =>
            {
                foreach (var startup in services.Where(s => s.ImplementationType == typeof(DevelopmentDatabase)).ToList())
                {
                    services.Remove(startup);
                }
            }));
}

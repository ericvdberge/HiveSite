using Microsoft.AspNetCore.Builder;

namespace Hivesite.Rendering.Tests;

public sealed class RenderingModuleTests
{
    [Fact]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddRenderingModule();
        await using var app = builder.Build();

        app.MapRenderingEndpoints();

        Assert.NotNull(app);
    }
}

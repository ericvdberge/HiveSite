using Microsoft.AspNetCore.Builder;

namespace Hivesite.Rendering.Tests;

[TestClass]
public sealed class RenderingModuleTests
{
    [TestMethod]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddRenderingModule();
        await using var app = builder.Build();

        app.MapRenderingEndpoints();

        Assert.IsNotNull(app);
    }
}

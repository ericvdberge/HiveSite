using Hivesite.Shared;
using Microsoft.AspNetCore.Builder;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class ContentModuleTests
{
    [TestMethod]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddSharedServices().AddContentModule();
        await using var app = builder.Build();

        app.MapContentEndpoints();

        Assert.IsNotNull(app);
    }
}

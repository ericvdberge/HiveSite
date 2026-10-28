using Hivesite.Shared;
using Microsoft.AspNetCore.Builder;

namespace Hivesite.Content.Tests;

public sealed class ContentModuleTests
{
    [Fact]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddSharedServices().AddContentModule();
        await using var app = builder.Build();

        app.MapContentEndpoints();

        Assert.NotNull(app);
    }
}

using Microsoft.AspNetCore.Builder;

namespace Hivesite.Publishing.Tests;

public sealed class PublishingModuleTests
{
    [Fact]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddPublishingModule();
        await using var app = builder.Build();

        app.MapPublishingEndpoints();

        Assert.NotNull(app);
    }
}

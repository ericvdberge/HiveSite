using Microsoft.AspNetCore.Builder;

namespace Hivesite.Publishing.Tests;

[TestClass]
public sealed class PublishingModuleTests
{
    [TestMethod]
    public async Task The_module_wires_into_a_host()
    {
        var builder = WebApplication.CreateSlimBuilder();
        builder.Services.AddPublishingModule();
        await using var app = builder.Build();

        app.MapPublishingEndpoints();

        Assert.IsNotNull(app);
    }
}

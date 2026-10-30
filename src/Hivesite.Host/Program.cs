using Hivesite.Content;
using Hivesite.Publishing;
using Hivesite.Rendering;
using Hivesite.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddSharedServices()
    .AddContentModule()
    .AddRenderingModule()
    .AddPublishingModule();

var app = builder.Build();

app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();

app.MapContentEndpoints();
app.MapRenderingEndpoints();
app.MapPublishingEndpoints();

app.Run();

/// <summary>Entry point, public so tests can host the app with WebApplicationFactory.</summary>
public partial class Program;

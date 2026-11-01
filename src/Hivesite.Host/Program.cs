using Hivesite.Content;
using Hivesite.Host;
using Hivesite.Publishing;
using Hivesite.Rendering;
using Hivesite.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddSharedServices()
    .AddContentModule()
    .AddRenderingModule()
    .AddPublishingModule()
    .AddStudioCors(builder.Configuration)
    .AddHivesiteOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseExceptionHandler();
app.UseCors(StudioCors.Policy);
app.UseAuthentication();
app.UseAuthorization();

app.MapContentEndpoints();
app.MapRenderingEndpoints();
app.MapPublishingEndpoints();

app.Run();

/// <summary>Entry point, public so tests can host the app with WebApplicationFactory.</summary>
public partial class Program;

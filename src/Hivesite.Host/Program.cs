using System.Text.Json;
using Hivesite.Content;
using Hivesite.Publishing;
using Hivesite.Rendering;
using Hivesite.Shared;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
builder.Services
    .AddContentModule()
    .AddRenderingModule()
    .AddPublishingModule();

var app = builder.Build();

app.UseExceptionHandler(error => error.Run(context =>
    Results.Json(
        ApiError.Of("internal_error", "Something went wrong on our side."),
        statusCode: StatusCodes.Status500InternalServerError)
    .ExecuteAsync(context)));

app.MapContentEndpoints();
app.MapRenderingEndpoints();
app.MapPublishingEndpoints();

app.Run();

/// <summary>Entry point, public so tests can host the app with WebApplicationFactory.</summary>
public partial class Program;

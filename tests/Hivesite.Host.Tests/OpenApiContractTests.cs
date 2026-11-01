using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Json.Schema;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Hivesite.Host.Tests;

/// <summary>
/// The OpenAPI document says what the specs say: every JSON example body of a spec validates against the schema the document
/// gives that request or response, and every documented error status and code is on its operation.
/// No database is needed: the document is built from endpoint metadata.
/// </summary>
[TestClass]
public sealed partial class OpenApiContractTests
{
    private static JsonObject document = null!;

    [GeneratedRegex(@"\{(\w+)\}")]
    private static partial Regex PathTemplate();

    [ClassInitialize]
    public static async Task LoadDocument(TestContext _)
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development"));
        using var client = factory.CreateClient();
        document = JsonNode.Parse(await client.GetStringAsync(new Uri("/openapi/v1.json", UriKind.Relative)))!.AsObject();
    }

    [TestMethod]
    [DataRow("API-001-sites.md", "POST /sites,GET /sites,GET /sites/{id},PATCH /sites/{id}")]
    [DataRow("API-002-pages-and-menu.md", "POST /sites/{id}/pages,GET /sites/{id}/pages,GET /pages/{id},PATCH /pages/{id},DELETE /pages/{id},PUT /sites/{id}/menu")]
    public void The_spec_is_read_whole(string specFile, string expected)
    {
        var read = SpecExamples.Read(specFile).Select(e => $"{e.Method} {e.Path}");

        CollectionAssert.AreEqual(expected.Split(','), read.ToArray());
    }

    [TestMethod]
    [DataRow("API-001-sites.md")]
    [DataRow("API-002-pages-and-menu.md")]
    public void Every_spec_example_body_validates_against_the_document(string specFile)
    {
        var checkedBodies = 0;
        foreach (var endpoint in SpecExamples.Read(specFile))
        {
            foreach (var body in endpoint.Bodies)
            {
                var results = Validate(SchemaOf(endpoint, body.Status), body.Json);

                Assert.IsTrue(results.IsValid, $"{endpoint.Method} {endpoint.Path} {(body.Status is { } s ? $"response {s}" : "request")} does not fit the document.");
                checkedBodies++;
            }
        }
        Assert.IsGreaterThan(0, checkedBodies);
    }

    [TestMethod]
    [DataRow("API-001-sites.md")]
    [DataRow("API-002-pages-and-menu.md")]
    public void Every_spec_error_is_documented_on_its_operation(string specFile)
    {
        foreach (var endpoint in SpecExamples.Read(specFile))
        {
            var operation = Operation(endpoint.Method, endpoint.Path);
            var description = operation["description"]?.GetValue<string>() ?? "";
            foreach (var error in endpoint.Errors)
            {
                var response = operation["responses"]?[error.Status.ToString(CultureInfo.InvariantCulture)];
                Assert.IsNotNull(response, $"{endpoint.Method} {endpoint.Path}: no {error.Status} response.");
                Assert.AreEqual("#/components/schemas/ApiError", response["content"]?["application/json"]?["schema"]?["$ref"]?.GetValue<string>(), $"{endpoint.Method} {endpoint.Path} {error.Status}: not the ApiError body.");
                StringAssert.Contains(description, $"{error.Status} `{error.Code}`", $"{endpoint.Method} {endpoint.Path}: `{error.Code}` is not described.");
            }
        }
    }

    [TestMethod]
    [DataRow("API-001-sites.md")]
    [DataRow("API-002-pages-and-menu.md")]
    public void Every_spec_operation_has_a_name_and_one_tag(string specFile)
    {
        foreach (var endpoint in SpecExamples.Read(specFile))
        {
            var operation = Operation(endpoint.Method, endpoint.Path);
            Assert.IsFalse(string.IsNullOrEmpty(operation["operationId"]?.GetValue<string>()), $"{endpoint.Method} {endpoint.Path}: no operationId.");
            Assert.AreEqual(1, operation["tags"]!.AsArray().Count, $"{endpoint.Method} {endpoint.Path}: not exactly one tag.");
        }
    }

    [TestMethod]
    public void Every_path_template_variable_is_a_required_uuid_path_parameter()
    {
        foreach (var (path, item) in document["paths"]!.AsObject())
        {
            foreach (var (method, operation) in item!.AsObject())
            {
                var declared = (operation!["parameters"]?.AsArray() ?? []).Where(p => p!["in"]!.GetValue<string>() == "path").ToDictionary(p => p!["name"]!.GetValue<string>(), p => p!);
                foreach (Match variable in PathTemplate().Matches(path))
                {
                    var name = variable.Groups[1].Value;
                    Assert.IsTrue(declared.TryGetValue(name, out var parameter), $"{method} {path}: no `in: path` parameter `{name}`.");
                    Assert.AreEqual(true, parameter["required"]?.GetValue<bool>(), $"{method} {path}: `{name}` is not required.");
                    Assert.AreEqual("string", parameter["schema"]?["type"]?.GetValue<string>(), $"{method} {path}: `{name}` is not a string.");
                    Assert.AreEqual("uuid", parameter["schema"]?["format"]?.GetValue<string>(), $"{method} {path}: `{name}` is not a uuid.");
                }
            }
        }
    }

    private static JsonObject Operation(string method, string path)
    {
        var operation = document["paths"]?[path]?[method.ToLowerInvariant()];
        Assert.IsNotNull(operation, $"{method} {path} is not in the document.");
        return operation.AsObject();
    }

    private static JsonNode SchemaOf(SpecEndpoint endpoint, int? status)
    {
        var operation = Operation(endpoint.Method, endpoint.Path);
        var content = status is { } code ? operation["responses"]?[code.ToString(CultureInfo.InvariantCulture)]?["content"] : operation["requestBody"]?["content"];
        var schema = content?["application/json"]?["schema"];
        Assert.IsNotNull(schema, $"{endpoint.Method} {endpoint.Path}: the document has no JSON schema for {(status is null ? "the request" : $"response {status}")}.");
        return schema;
    }

    /// <summary>The schema's <c>$ref</c>s point into the document's components, so they ride along (as <c>$defs</c>) in the schema being checked.</summary>
    private static EvaluationResults Validate(JsonNode schemaNode, string json)
    {
        const string Components = "#/components/schemas/";
        var schema = JsonNode.Parse(schemaNode.ToJsonString().Replace(Components, "#/$defs/", StringComparison.Ordinal))!.AsObject();
        schema["$defs"] = JsonNode.Parse(document["components"]!["schemas"]!.ToJsonString().Replace(Components, "#/$defs/", StringComparison.Ordinal));
        var compiled = JsonSchema.FromText(schema.ToJsonString());
        return compiled.Evaluate(JsonDocument.Parse(json).RootElement, new EvaluationOptions { RequireFormatValidation = true });
    }
}

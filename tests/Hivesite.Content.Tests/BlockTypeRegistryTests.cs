using System.Text.Json;
using System.Text.Json.Nodes;
using Hivesite.Content.Contracts;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;
using Json.Schema;
using Microsoft.Extensions.DependencyInjection;

namespace Hivesite.Content.Tests;

/// <summary>The registry, its schemas and the contract. None of these need PostgreSQL.</summary>
[TestClass]
public sealed class BlockTypeRegistryTests
{
    private static readonly string[] Keywords =
    [
        "type", "const", "enum", "oneOf", "required", "properties", "additionalProperties", "items", "minItems", "maxItems",
        "minLength", "maxLength", "minimum", "maximum", "pattern", "default", "$ref", "$defs",
    ];

    private static readonly BlockTypeRegistry Registry = new();

    private static JsonNode Schema(string type) => JsonNode.Parse(Registry.All.Single(t => t.Type == type).Schema.GetRawText())!;

    private static bool Passes(string type, string node) =>
        JsonSchema.FromText(Schema(type).ToJsonString()).Evaluate(JsonDocument.Parse(node).RootElement).IsValid;

    private static string Repeat(string text, int times) => string.Concat(Enumerable.Repeat(text, times));

    [TestMethod]
    public void The_registry_holds_the_seven_types_in_order_with_their_texts_AC1()
    {
        CollectionAssert.AreEqual(
            BlockTypeSpec.Table.Select(t => (t.Type, t.Name, t.Description)).ToList(),
            Registry.All.Select(t => (t.Type, t.Name, t.Description)).ToList());
        Assert.IsTrue(Registry.All.All(t => t.Version == 1));
    }

    [TestMethod]
    public void Every_schema_is_the_spec_schema_between_schema_and_defs_AC2()
    {
        foreach (var (type, _, _) in BlockTypeSpec.Table)
        {
            var served = Schema(type).AsObject();
            var keys = served.Select(p => p.Key).ToList();

            Assert.AreEqual("$schema", keys[0], type);
            Assert.AreEqual(BlockTypeSpec.SchemaUri, served["$schema"]!.GetValue<string>(), type);
            Assert.AreEqual("$defs", keys[^1], type);
            Assert.IsTrue(JsonNode.DeepEquals(BlockTypeSpec.Defs(), served["$defs"]), $"{type}: $defs differ from Shared definitions.");

            served.Remove("$schema");
            served.Remove("$defs");
            Assert.IsTrue(JsonNode.DeepEquals(BlockTypeSpec.Own(type), served), $"{type}: schema differs from the spec.");
        }
    }

    [TestMethod]
    public void Schemas_use_only_the_allowed_keywords_closed_objects_and_local_refs_AC3()
    {
        foreach (var (type, _, _) in BlockTypeSpec.Table)
        {
            var schema = Schema(type).AsObject();
            var defs = schema["$defs"]!.AsObject();
            schema.Remove("$schema");
            CheckSchema(type, schema, defs);
        }
    }

    private static void CheckSchema(string where, JsonNode schema, JsonObject defs)
    {
        var node = schema.AsObject();
        foreach (var (keyword, value) in node)
        {
            Assert.Contains(keyword, Keywords, $"{where}: keyword {keyword} is not allowed.");
            switch (keyword)
            {
                case "properties" or "$defs":
                    foreach (var (name, child) in value!.AsObject())
                    {
                        CheckSchema($"{where}/{name}", child!, defs);
                    }
                    break;
                case "items":
                    CheckSchema($"{where}/items", value!, defs);
                    break;
                case "oneOf":
                    foreach (var branch in value!.AsArray())
                    {
                        CheckSchema($"{where}/oneOf", branch!, defs);
                    }
                    break;
                case "$ref":
                    var reference = value!.GetValue<string>();
                    Assert.StartsWith("#/$defs/", reference, where);
                    Assert.IsTrue(defs.ContainsKey(reference["#/$defs/".Length..]), $"{where}: {reference} does not resolve.");
                    break;
            }
        }

        if (node["type"] is JsonValue kind && kind.GetValue<string>() == "object")
        {
            Assert.IsFalse(node["additionalProperties"]!.GetValue<bool>(), $"{where}: additionalProperties must be false.");
        }
    }

    private static readonly Dictionary<string, string> Valid = new()
    {
        ["hero"] = """{"type":"hero","attrs":{"title":"Welcome","subtitle":"Handmade","image":{"url":"https://example.com/a.jpg","alt":"A bowl"},"cta":{"label":"Visit","href":"/about"}}}""",
        ["rich_text"] = """
            {"type":"rich_text","content":[
              {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"The studio"}]},
              {"type":"paragraph","content":[
                {"type":"text","text":"Every piece is thrown, glazed and fired in "},
                {"type":"text","marks":[{"type":"bold"}],"text":"Utrecht"},
                {"type":"text","text":"."}]}]}
            """,
        ["image"] = """{"type":"image","attrs":{"image":{"url":"https://example.com/a.jpg","alt":"A bowl"}}}""",
        ["gallery"] = """{"type":"gallery","attrs":{"images":[{"url":"https://example.com/a.jpg","alt":"A"}]}}""",
        ["card_list"] = """{"type":"card_list","attrs":{"heading":"Explore","layout":"grid","source":{"kind":"collection","entity_type":"page","sort":"natural","page_size":12}}}""",
        ["contact_form"] = """{"type":"contact_form","attrs":{"action_url":"https://forms.example.com/x","fields":[{"name":"email","label":"Email","kind":"email"}]}}""",
        ["embed"] = """{"type":"embed","attrs":{"provider":"youtube","url":"https://youtu.be/abc","title":"Film"}}""",
    };

    private static readonly Dictionary<string, string> UnknownAttribute = new()
    {
        ["hero"] = """{"type":"hero","attrs":{"title":"A","color":"red"}}""",
        ["rich_text"] = """{"type":"rich_text","attrs":{},"content":[{"type":"paragraph"}]}""",
        ["image"] = """{"type":"image","attrs":{"image":{"url":"https://example.com/a.jpg","alt":"A"},"border":1}}""",
        ["gallery"] = """{"type":"gallery","attrs":{"images":[{"url":"https://example.com/a.jpg","alt":"A"}],"gap":2}}""",
        ["card_list"] = """{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"page"},"gap":2}}""",
        ["contact_form"] = """{"type":"contact_form","attrs":{"action_url":"https://forms.example.com/x","fields":[{"name":"email","label":"Email","kind":"email"}],"captcha":true}}""",
        ["embed"] = """{"type":"embed","attrs":{"provider":"vimeo","url":"https://vimeo.com/1","title":"Film","autoplay":true}}""",
    };

    private static readonly Dictionary<string, string> MissingRequired = new()
    {
        ["hero"] = """{"type":"hero","attrs":{"subtitle":"No title"}}""",
        ["rich_text"] = """{"type":"rich_text"}""",
        ["image"] = """{"type":"image","attrs":{"caption":"No image"}}""",
        ["gallery"] = """{"type":"gallery","attrs":{"columns":3}}""",
        ["card_list"] = """{"type":"card_list","attrs":{"heading":"No source"}}""",
        ["contact_form"] = """{"type":"contact_form","attrs":{"action_url":"https://forms.example.com/x"}}""",
        ["embed"] = """{"type":"embed","attrs":{"provider":"youtube","url":"https://youtu.be/abc"}}""",
    };

    private static readonly Dictionary<string, string> OverLimit = new()
    {
        ["hero"] = $$$"""{"type":"hero","attrs":{"title":"{{{Repeat("😀", 81)}}}"}}""",
        ["rich_text"] = """{"type":"rich_text","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Too big"}]}]}""",
        ["image"] = $$$"""{"type":"image","attrs":{"image":{"url":"https://example.com/a.jpg","alt":"A"},"caption":"{{{Repeat("c", 201)}}}"}}""",
        ["gallery"] = """{"type":"gallery","attrs":{"images":[""" + string.Join(',', Enumerable.Repeat("""{"url":"https://example.com/a.jpg","alt":"A"}""", 25)) + "]}}",
        ["card_list"] = """{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"page","page_size":51}}}""",
        ["contact_form"] = """{"type":"contact_form","attrs":{"action_url":"https://forms.example.com/x","fields":[{"name":"Email","label":"Email","kind":"email"}]}}""",
        ["embed"] = $$$"""{"type":"embed","attrs":{"provider":"youtube","url":"https://youtu.be/abc","title":"{{{Repeat("t", 121)}}}"}}""",
    };

    [TestMethod]
    public void Valid_nodes_pass_their_schema_AC4()
    {
        foreach (var (type, node) in Valid)
        {
            Assert.IsTrue(Passes(type, node), $"{type} should pass.");
        }
    }

    [TestMethod]
    public void A_title_of_80_code_points_passes_and_81_fails_AC4()
    {
        Assert.IsTrue(Passes("hero", $$$"""{"type":"hero","attrs":{"title":"{{{Repeat("😀", 80)}}}"}}"""));
        Assert.IsFalse(Passes("hero", OverLimit["hero"]));
    }

    [TestMethod]
    public void A_manual_card_list_and_every_rich_text_shape_pass_AC4()
    {
        Assert.IsTrue(Passes("card_list", """{"type":"card_list","attrs":{"source":{"kind":"manual","cards":[{"title":"A","image":null,"action":{"label":"Go","href":"https://example.com"}}]}}}"""));
        Assert.IsTrue(Passes("rich_text", """
            {"type":"rich_text","content":[
              {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","marks":[{"type":"link","attrs":{"href":"mailto:a@b.nl","target":null}},{"type":"italic"}],"text":"x"},{"type":"hardBreak"}]}]}]},
              {"type":"orderedList","attrs":{"start":2,"type":null},"content":[{"type":"listItem","content":[{"type":"paragraph"}]}]}]}
            """));
    }

    [TestMethod]
    public void A_node_with_an_unknown_attribute_fails_AC4()
    {
        foreach (var (type, node) in UnknownAttribute)
        {
            Assert.IsFalse(Passes(type, node), $"{type} should fail.");
        }
    }

    [TestMethod]
    public void A_node_with_a_missing_required_attribute_fails_AC4()
    {
        foreach (var (type, node) in MissingRequired)
        {
            Assert.IsFalse(Passes(type, node), $"{type} should fail.");
        }
    }

    [TestMethod]
    public void A_node_with_an_over_limit_value_fails_AC4()
    {
        foreach (var (type, node) in OverLimit)
        {
            Assert.IsFalse(Passes(type, node), $"{type} should fail.");
        }
    }

    [TestMethod]
    public void The_contract_offers_the_same_registry_as_contract_dtos_AC10()
    {
        var services = new ServiceCollection().AddSharedServices().AddContentModule();
        services.AddSingleton<Microsoft.Extensions.Configuration.IConfiguration>(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());   // the snapshot service needs the DbContext, which is never opened here
        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var api = scope.ServiceProvider.GetRequiredService<IContentApi>();
        var types = api.ListBlockTypesAsync().GetAwaiter().GetResult();

        CollectionAssert.AreEqual(BlockTypeSpec.Table.Select(t => t.Type).ToList(), types.Select(t => t.Type).ToList());
        Assert.IsTrue(types.All(t => t.GetType() == typeof(BlockTypeInfo)));
        foreach (var info in types)
        {
            var spec = BlockTypeSpec.Table.Single(t => t.Type == info.Type);
            Assert.AreEqual(spec.Name, info.Name);
            Assert.AreEqual(spec.Description, info.Description);
            Assert.AreEqual(1, info.Version);
            Assert.IsTrue(JsonNode.DeepEquals(BlockTypeSpec.Full(info.Type), JsonNode.Parse(info.Schema.GetRawText())), $"{info.Type}: schema differs.");
            Assert.AreEqual(JsonValueKind.Object, info.Schema.ValueKind);
        }
    }
}

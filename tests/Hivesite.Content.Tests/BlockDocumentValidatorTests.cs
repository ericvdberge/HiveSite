using System.Text.Json.Nodes;
using Hivesite.Content.Application;
using Hivesite.Content.Infrastructure;
using Hivesite.Shared;

namespace Hivesite.Content.Tests;

/// <summary>API-004 Validation without PostgreSQL: the shape, the schemas of the seven block types, trimming, defaults and the check order.</summary>
[TestClass]
public sealed class BlockDocumentValidatorTests
{
    private static readonly BlockDocumentValidator Validator = new(new BlockTypeRegistry());

    private const string Url = "https://example.com/a.png";
    private const string Hero = """{"type":"hero","attrs":{"title":"T"}}""";

    /// <summary>One minimal valid node of each of the seven types.</summary>
    private static readonly Dictionary<string, string> Minimal = new()
    {
        ["hero"] = Hero,
        ["rich_text"] = """{"type":"rich_text","content":[{"type":"paragraph"}]}""",
        ["image"] = """{"type":"image","attrs":{"image":{"url":"@","alt":""}}}""".Replace("@", Url, StringComparison.Ordinal),
        ["gallery"] = """{"type":"gallery","attrs":{"images":[{"url":"@","alt":""}]}}""".Replace("@", Url, StringComparison.Ordinal),
        ["card_list"] = """{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"page"}}}""",
        ["contact_form"] = """{"type":"contact_form","attrs":{"action_url":"https://example.com/send","fields":[{"name":"email","label":"Email","kind":"email"}]}}""",
        ["embed"] = """{"type":"embed","attrs":{"provider":"youtube","url":"https://www.youtube.com/embed/x","title":"Film"}}""",
    };

    private static string Doc(params string[] blocks) => $$"""{"type":"doc","content":[{{string.Join(',', blocks)}}]}""";

    private static Result<JsonObject> Check(string json) => Validator.Validate(JsonNode.Parse(json));

    private static string Example(string name) => File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Examples", name));

    private static JsonObject Stored(string json)
    {
        var result = Check(json);
        Assert.IsTrue(result.IsSuccess, result.Error?.Message);
        return result.Value;
    }

    private static string Repeat(string text, int times) => string.Concat(Enumerable.Repeat(text, times));

    private static void AssertFails(string json, string code, string field, string? message = null)
    {
        var result = Check(json);
        Assert.IsFalse(result.IsSuccess, "The document was accepted.");
        Assert.AreEqual(code, result.Error.Code, result.Error.Message);
        Assert.AreEqual(field, result.Error.Field, result.Error.Message);
        if (message is not null)
        {
            Assert.AreEqual($"{field}: {message}", result.Error.Message);
        }
    }

    [TestMethod]
    [DataRow("[]")]
    [DataRow("null")]
    [DataRow("5")]
    [DataRow("""{"type":"page","content":[]}""")]
    [DataRow("""{"content":[]}""")]
    [DataRow("""{"type":"doc"}""")]
    [DataRow("""{"type":"doc","content":{}}""")]
    [DataRow("""{"type":"doc","content":[],"extra":1}""")]
    [DataRow("""{"type":"doc","content":[5]}""")]
    [DataRow("""{"type":"doc","content":[{}]}""")]
    [DataRow("""{"type":"doc","content":[{"type":3}]}""")]
    public void A_document_of_the_wrong_shape_is_invalid_request_AC7(string json)
    {
        var result = Check(json);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("invalid_request", result.Error.Code);
    }

    [TestMethod]
    public void Shape_errors_point_at_the_failing_value_AC7()
    {
        AssertFails("""{"type":"doc","content":[{"type":"hero"},{}]}""", "invalid_request", "/content/1/type");
        AssertFails("""{"type":"doc","content":[],"x":1}""", "invalid_request", "/x");
        AssertFails("""{"type":"doc"}""", "invalid_request", "/content");
    }

    [TestMethod]
    [DataRow("Hero")]
    [DataRow("columns")]
    [DataRow("doc")]
    [DataRow("")]
    public void An_unknown_block_type_is_refused_with_its_pointer_AC8(string type)
    {
        AssertFails(Doc(Hero, Hero, Hero, $$"""{"type":"{{type}}"}"""), "unknown_block_type", "/content/3/type");
    }

    [TestMethod]
    [DataRow("hero")]
    [DataRow("rich_text")]
    [DataRow("image")]
    [DataRow("gallery")]
    [DataRow("card_list")]
    [DataRow("contact_form")]
    [DataRow("embed")]
    public void A_minimal_node_of_each_type_is_valid_AC9(string type)
    {
        Assert.AreEqual(type, Stored(Doc(Minimal[type]))["content"]![0]!["type"]!.GetValue<string>());
    }

    [TestMethod]
    public void The_spec_example_is_valid_and_stored_as_the_spec_GET_example_AC3()
    {
        var stored = Stored(Example("blocks-put-request.json"));

        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(Example("blocks-get-response.json")), stored), stored.ToJsonString());
    }

    [TestMethod]
    [DataRow("""{"type":"hero","attrs":{"title":"T","foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"hero","attrs":{}}""", "/content/0/attrs")]
    [DataRow("""{"type":"hero"}""", "/content/0")]
    [DataRow("""{"type":"hero","attrs":{"title":null}}""", "/content/0/attrs/title")]
    [DataRow("""{"type":"hero","attrs":{"title":"T","subtitle":null}}""", "/content/0/attrs/subtitle")]
    [DataRow("""{"type":"hero","attrs":{"title":"T","image":{"url":"http://x.test/a.png","alt":""}}}""", "/content/0/attrs/image/url")]
    [DataRow("""{"type":"hero","attrs":{"title":"T","cta":{"label":"Go","href":"nope"}}}""", "/content/0/attrs/cta/href")]
    [DataRow("""{"type":"rich_text","content":[{"type":"heading","attrs":{"level":1}}]}""", "/content/0/content/0/attrs/level")]
    [DataRow("""{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"underline"}]}]}]}""", "/content/0/content/0/content/0/marks/0")]
    [DataRow("""{"type":"rich_text","content":[]}""", "/content/0/content")]
    [DataRow("""{"type":"image","attrs":{"image":{"url":"https://x.test/a.png"}}}""", "/content/0/attrs/image")]
    [DataRow("""{"type":"image","attrs":{"image":{"url":"https://x.test/a.png","alt":""},"width":"huge"}}""", "/content/0/attrs/width")]
    [DataRow("""{"type":"gallery","attrs":{"images":[{"url":"https://x.test/a.png","alt":""}],"columns":5}}""", "/content/0/attrs/columns")]
    [DataRow("""{"type":"gallery","attrs":{"images":[]}}""", "/content/0/attrs/images")]
    [DataRow("""{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"post"}}}""", "/content/0/attrs/source/entity_type")]
    [DataRow("""{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"page","page_size":51}}}""", "/content/0/attrs/source/page_size")]
    [DataRow("""{"type":"card_list","attrs":{"source":{"kind":"manual","cards":[{"title":""}]}}}""", "/content/0/attrs/source/cards/0/title")]
    [DataRow("""{"type":"card_list","attrs":{"source":{"kind":"other"}}}""", "/content/0/attrs/source")]
    [DataRow("""{"type":"contact_form","attrs":{"action_url":"https://x.test/s","fields":[{"name":"Email","label":"E","kind":"email"}]}}""", "/content/0/attrs/fields/0/name")]
    [DataRow("""{"type":"contact_form","attrs":{"action_url":"https://x.test/s","fields":[{"name":"a","label":"E","kind":"date"}]}}""", "/content/0/attrs/fields/0/kind")]
    [DataRow("""{"type":"contact_form","attrs":{"action_url":"https://x.test/s","fields":[{"name":"a","label":"E","kind":"text","required":null}]}}""", "/content/0/attrs/fields/0/required")]
    [DataRow("""{"type":"embed","attrs":{"provider":"tiktok","url":"https://x.test/v","title":"F"}}""", "/content/0/attrs/provider")]
    [DataRow("""{"type":"embed","attrs":{"provider":"vimeo","url":"https://x.test/v"}}""", "/content/0/attrs")]
    [DataRow("""{"type":"rich_text","attrs":{"x":1},"content":[{"type":"paragraph"}]}""", "/content/0/attrs")]
    [DataRow("""{"type":"image","attrs":{"image":{"url":"https://x.test/a.png","alt":""},"foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"gallery","attrs":{"images":[{"url":"https://x.test/a.png","alt":""}],"foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"card_list","attrs":{"source":{"kind":"collection","entity_type":"page"},"foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"contact_form","attrs":{"action_url":"https://x.test/s","fields":[{"name":"a","label":"A","kind":"text"}],"foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"embed","attrs":{"provider":"vimeo","url":"https://x.test/v","title":"F","foo":1}}""", "/content/0/attrs/foo")]
    [DataRow("""{"type":"rich_text","content":null}""", "/content/0/content")]
    [DataRow("""{"type":"image","attrs":{"image":null}}""", "/content/0/attrs/image")]
    [DataRow("""{"type":"gallery","attrs":{"images":null}}""", "/content/0/attrs/images")]
    [DataRow("""{"type":"card_list","attrs":{"source":null}}""", "/content/0/attrs/source")]
    [DataRow("""{"type":"embed","attrs":{"provider":"vimeo","url":"https://x.test/v","title":null}}""", "/content/0/attrs/title")]
    [DataRow("""{"type":"rich_text"}""", "/content/0")]
    [DataRow("""{"type":"gallery","attrs":{}}""", "/content/0/attrs")]
    [DataRow("""{"type":"card_list","attrs":{}}""", "/content/0/attrs")]
    [DataRow("""{"type":"contact_form","attrs":{}}""", "/content/0/attrs")]
    [DataRow("""{"type":"embed","attrs":{"provider":"vimeo","url":"https://x.test/v","title":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}""", "/content/0/attrs/title")]
    public void A_node_that_breaks_its_schema_is_invalid_block_with_the_pointer_AC9(string node, string field)
    {
        AssertFails(Doc(node), "invalid_block", field);
    }

    [TestMethod]
    public void Messages_name_the_problem_after_the_pointer_AC9()
    {
        AssertFails(Doc($$$"""{"type":"hero","attrs":{"title":"{{{Repeat("a", 81)}}}"}}"""), "invalid_block", "/content/0/attrs/title", "must be at most 80 characters");
        var images = string.Join(',', Enumerable.Repeat($$"""{"url":"{{Url}}","alt":""}""", 25));
        AssertFails(Doc($$$"""{"type":"gallery","attrs":{"images":[{{{images}}}]}}"""), "invalid_block", "/content/0/attrs/images", "must have at most 24 items");
    }

    [TestMethod]
    public void Lengths_count_code_points_not_utf16_units_AC9()
    {
        Assert.IsTrue(Check(Doc($$$"""{"type":"hero","attrs":{"title":"{{{Repeat("😀", 80)}}}"}}""")).IsSuccess);
        AssertFails(Doc($$$"""{"type":"hero","attrs":{"title":"{{{Repeat("😀", 81)}}}"}}"""), "invalid_block", "/content/0/attrs/title");
    }

    [TestMethod]
    public void The_card_list_example_of_API_003_is_valid_AC9()
    {
        var stored = Stored(Doc("""{"type":"card_list","attrs":{"heading":"Explore","layout":"grid","source":{"kind":"collection","entity_type":"page","sort":"natural","page_size":12}}}"""));

        AssertJson("""{"heading":"Explore","layout":"grid","source":{"kind":"collection","entity_type":"page","sort":"natural","page_size":12}}""", stored["content"]![0]!["attrs"]);
    }

    [TestMethod]
    public void Lengths_count_code_points_also_for_combining_marks_and_flags_AC9()
    {
        // "e" + U+0301 is one grapheme but two code points; a flag is one grapheme and two code points. 40 of either are 80 code points.
        foreach (var unit in new[] { "e\u0301", "\U0001F1F3\U0001F1F1" })
        {
            Assert.IsTrue(Check(Doc($$$"""{"type":"hero","attrs":{"title":"{{{Repeat(unit, 40)}}}"}}""")).IsSuccess);
            AssertFails(Doc($$$"""{"type":"hero","attrs":{"title":"{{{Repeat(unit, 41)}}}"}}"""), "invalid_block", "/content/0/attrs/title", "must be at most 80 characters");
        }
    }

    [TestMethod]
    public void The_text_of_a_text_node_is_limited_in_code_points_too_AC9()
    {
        string Paragraph(string text) => Doc($$$"""{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"{{{text}}}"}]}]}""");

        Assert.IsTrue(Check(Paragraph(Repeat("\U0001F1F3\U0001F1F1", 5000))).IsSuccess);
        AssertFails(Paragraph(Repeat("\U0001F1F3\U0001F1F1", 5001)), "invalid_block", "/content/0/content/0/content/0/text", "must be at most 10000 characters");
    }

    [TestMethod]
    public void Plain_strings_are_trimmed_but_the_text_of_text_nodes_is_not_AC11()
    {
        var stored = Stored(Doc(
            """{"type":"hero","attrs":{"title":"  Hello  "}}""",
            """{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"fired in "},{"type":"text","marks":[{"type":"bold"}],"text":" Utrecht"}]}]}"""));

        Assert.AreEqual("Hello", stored["content"]![0]!["attrs"]!["title"]!.GetValue<string>());
        var runs = stored["content"]![1]!["content"]![0]!["content"]!;
        Assert.AreEqual("fired in ", runs[0]!["text"]!.GetValue<string>());
        Assert.AreEqual(" Utrecht", runs[1]!["text"]!.GetValue<string>());
        AssertFails(Doc("""{"type":"hero","attrs":{"title":"   "}}"""), "invalid_block", "/content/0/attrs/title");
    }

    [TestMethod]
    public void Every_default_is_stored_at_every_depth_AC12()
    {
        var stored = Stored(Doc(
            Minimal["hero"],
            Minimal["card_list"],
            """{"type":"card_list","attrs":{"source":{"kind":"manual","cards":[{"title":"A"}]}}}""",
            Minimal["gallery"],
            Minimal["contact_form"],
            Minimal["embed"],
            Minimal["image"],
            """{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"a","marks":[{"type":"link","attrs":{"href":"/x"}}]}]},{"type":"orderedList","attrs":{},"content":[{"type":"listItem","content":[{"type":"paragraph"}]}]}]}"""));

        var blocks = stored["content"]!.AsArray();
        AssertJson("""{"title":"T","subtitle":"","image":null,"cta":null}""", blocks[0]!["attrs"]);
        AssertJson("""{"source":{"kind":"collection","entity_type":"page","sort":"natural","page_size":12},"heading":"","layout":"grid"}""", blocks[1]!["attrs"]);
        AssertJson("""{"title":"A","body":"","image":null,"action":null}""", blocks[2]!["attrs"]!["source"]!["cards"]![0]);
        AssertJson("""{"url":"https://example.com/a.png","alt":"","caption":""}""", blocks[3]!["attrs"]!["images"]![0]);
        Assert.AreEqual(3, blocks[3]!["attrs"]!["columns"]!.GetValue<int>());
        Assert.AreEqual("Send", blocks[4]!["attrs"]!["submit_label"]!.GetValue<string>());
        Assert.IsFalse(blocks[4]!["attrs"]!["fields"]![0]!["required"]!.GetValue<bool>());
        Assert.AreEqual("16:9", blocks[5]!["attrs"]!["aspect_ratio"]!.GetValue<string>());
        Assert.AreEqual("content", blocks[6]!["attrs"]!["width"]!.GetValue<string>());
        Assert.AreEqual("", blocks[6]!["attrs"]!["caption"]!.GetValue<string>());
        AssertJson("""{"href":"/x","target":null,"rel":null,"class":null}""", blocks[7]!["content"]![0]!["content"]![0]!["marks"]![0]!["attrs"]);
        AssertJson("""{"start":1,"type":null}""", blocks[7]!["content"]![1]!["attrs"]);
    }

    private static void AssertJson(string expected, JsonNode? actual) =>
        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(expected), actual), actual?.ToJsonString());

    [TestMethod]
    public void Null_is_accepted_where_the_schema_allows_it_AC12()
    {
        Assert.IsTrue(Check(Doc("""{"type":"hero","attrs":{"title":"T","image":null,"cta":null}}""")).IsSuccess);
    }

    [TestMethod]
    public void Validating_the_stored_document_again_changes_nothing_AC4()
    {
        var once = Stored(Example("blocks-put-request.json"));

        Assert.IsTrue(JsonNode.DeepEquals(once, Stored(once.ToJsonString())));
    }

    [TestMethod]
    public void Zero_and_forty_blocks_pass_and_forty_one_is_too_many_AC6()
    {
        Assert.AreEqual(0, Stored(Doc())["content"]!.AsArray().Count);
        Assert.AreEqual(40, Stored(Doc(Enumerable.Repeat(Hero, 40).ToArray()))["content"]!.AsArray().Count);
        AssertFails(Doc(Enumerable.Repeat(Hero, 41).ToArray()), "too_many_blocks", "/content");
    }

    [TestMethod]
    public void The_first_failure_follows_the_spec_order_AC13()
    {
        // 41 blocks with a bad first block: the count comes first.
        AssertFails(Doc(Enumerable.Repeat("""{"type":"hero","attrs":{}}""", 41).ToArray()), "too_many_blocks", "/content");
        // A shape error anywhere comes before the count.
        AssertFails(Doc(Enumerable.Repeat(Hero, 41).Append("{}").ToArray()), "invalid_request", "/content/41/type");
        // Block by block: a bad block 0 beats an unknown type at block 1, and an unknown type beats a later bad block.
        AssertFails(Doc("""{"type":"hero","attrs":{}}""", """{"type":"nope"}"""), "invalid_block", "/content/0/attrs");
        AssertFails(Doc(Hero, """{"type":"nope"}""", """{"type":"hero","attrs":{}}"""), "unknown_block_type", "/content/1/type");
    }

    [TestMethod]
    public void Validation_does_not_change_the_document_it_is_given_AC14()
    {
        var input = JsonNode.Parse(Doc("""{"type":"hero","attrs":{"title":"  T  "}}"""))!;
        var before = input.ToJsonString();

        Validator.Validate(input);

        Assert.AreEqual(before, input.ToJsonString());
    }

    private const string BadEmbed = """{"type":"embed","attrs":{"provider":"vimeo","url":"https://www.youtube.com/embed/x","title":"Film"}}""";

    [TestMethod]
    public void The_text_limit_is_per_block_not_per_document_AC4()
    {
        var block = $$"""{"type":"rich_text","content":[{"type":"paragraph","content":[{"type":"text","text":"{{Repeat("a", 6000)}}"}]}]}""";

        Assert.IsTrue(Check(Doc(block, block)).IsSuccess);
    }

    [TestMethod]
    public void A_rule_failure_in_block_0_comes_before_a_schema_failure_in_block_1_AC9()
    {
        AssertFails(Doc(BadEmbed, """{"type":"hero","attrs":{}}"""), "invalid_block", "/content/0/attrs/url", "must be a Vimeo address");
    }

    [TestMethod]
    public void A_schema_failure_comes_before_a_rule_failure_in_the_same_block_AC9()
    {
        AssertFails(Doc(BadEmbed.Replace("\"title\":\"Film\"", "\"title\":\"\"", StringComparison.Ordinal)), "invalid_block", "/content/0/attrs/title");
    }

    [TestMethod]
    public void Rules_follow_the_order_of_the_spec_within_a_block_AC9()
    {
        var text = """{"type":"text","text":"a","marks":[{"type":"bold"},{"type":"bold"}]}""";
        var list = $$"""{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{{text}}]}]}]}]}]}""";

        AssertFails(Doc($$"""{"type":"rich_text","content":[{{list}}]}"""), "invalid_block", "/content/0/content/0/content/0/content/0");
    }

    [TestMethod]
    public void The_rules_leave_a_valid_document_as_the_schema_check_made_it_AC10()
    {
        var stored = Stored(Example("blocks-put-request.json"));

        Assert.IsTrue(JsonNode.DeepEquals(JsonNode.Parse(Example("blocks-get-response.json"))!["content"], stored["content"]));
        foreach (var block in Minimal.Values)
        {
            Assert.IsTrue(Check(Doc(block)).IsSuccess);
        }
    }
}

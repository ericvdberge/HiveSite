using System.Text.Json.Nodes;
using Hivesite.Content.Application;
using Hivesite.Shared;

namespace Hivesite.Content.Tests;

/// <summary>API-003 "Rules beyond the schemas" on single blocks, without PostgreSQL (#127).</summary>
[TestClass]
public sealed class BlockRulesTests
{
    private const string Form = """{"type":"contact_form","attrs":{"action_url":"@","fields":[{"name":"a","label":"A","kind":"text"},{"name":"b","label":"A","kind":"text"}]}}""";

    private static Error? Check(string json, int index = 0) => BlockRules.Check(JsonNode.Parse(json)!.AsObject(), $"/content/{index}");

    private static string Text(string text, string marks = "") =>
        $$"""{"type":"text","text":"{{text}}"{{(marks.Length > 0 ? $",\"marks\":[{marks}]" : "")}}}""";

    private static string Paragraph(params string[] inline) => $$"""{"type":"paragraph","content":[{{string.Join(',', inline)}}]}""";

    private static string RichText(params string[] nodes) => $$"""{"type":"rich_text","content":[{{string.Join(',', nodes)}}]}""";

    private static string Item(params string[] children) => $$"""{"type":"listItem","content":[{{string.Join(',', children)}}]}""";

    private static string List(string kind, params string[] items) => $$"""{"type":"{{kind}}","content":[{{string.Join(',', items)}}]}""";

    private static string Embed(string provider, string url) => $$$"""{"type":"embed","attrs":{"provider":"{{{provider}}}","url":"{{{url}}}","title":"T"}}""";

    private static void AssertFails(Error? error, string field, string? message = null)
    {
        Assert.IsNotNull(error);
        Assert.AreEqual("invalid_block", error.Code);
        Assert.AreEqual(field, error.Field);
        Assert.StartsWith($"{field}: ", error.Message);
        if (message is not null)
        {
            Assert.AreEqual($"{field}: {message}", error.Message);
        }
    }

    [TestMethod]
    [DataRow("https://", "/content/0/attrs/image/url")]
    [DataRow("https:///path", "/content/0/attrs/image/url")]
    [DataRow("https://:8080/x", "/content/0/attrs/image/url")]
    public void An_https_url_without_a_host_is_refused_AC1(string url, string field)
    {
        AssertFails(Check($$$$"""{"type":"image","attrs":{"image":{"url":"{{{{url}}}}","alt":""}}}"""), field, "must have a host");
    }

    [TestMethod]
    public void Every_place_of_a_url_or_link_is_checked_AC1()
    {
        AssertFails(Check("""{"type":"gallery","attrs":{"images":[{"url":"https://a.nl/x","alt":""},{"url":"https://","alt":""}]}}"""), "/content/0/attrs/images/1/url");
        AssertFails(Check(Form.Replace("@", "https://", StringComparison.Ordinal)), "/content/0/attrs/action_url");
        AssertFails(Check(Embed("youtube", "https://")), "/content/0/attrs/url");
        AssertFails(Check("""{"type":"hero","attrs":{"title":"T","cta":{"label":"Go","href":"https://"}}}"""), "/content/0/attrs/cta/href");
        AssertFails(
            Check(RichText(Paragraph(Text("a"), Text("b", """{"type":"link","attrs":{"href":"https://"}}""")))),
            "/content/0/content/0/content/1/marks/0/attrs/href");
    }

    [TestMethod]
    [DataRow("https://example.com/x")]
    [DataRow("mailto:a@b.nl")]
    [DataRow("/")]
    [DataRow("/about")]
    public void Urls_with_a_host_mail_links_and_site_paths_pass_AC1(string href)
    {
        Assert.IsNull(Check($$$$"""{"type":"hero","attrs":{"title":"T","cta":{"label":"Go","href":"{{{{href}}}}"}}}"""));
    }

    [TestMethod]
    public void Two_fields_of_the_same_name_are_refused_at_the_second_AC2()
    {
        var form = """{"type":"contact_form","attrs":{"action_url":"https://a.nl/s","fields":[{"name":"a","label":"A","kind":"text"},{"name":"b","label":"B","kind":"text"},{"name":"a","label":"C","kind":"text"}]}}""";

        AssertFails(Check(form, 3), "/content/3/attrs/fields/2/name", "must be unique within the form");
    }

    [TestMethod]
    public void Different_names_pass_also_with_the_same_label_AC2()
    {
        Assert.IsNull(Check(Form.Replace("@", "https://a.nl/s", StringComparison.Ordinal)));
    }

    [TestMethod]
    [DataRow("youtube", "https://www.youtube.com/embed/x")]
    [DataRow("youtube", "https://youtube.com/embed/x")]
    [DataRow("youtube", "https://youtu.be/x")]
    [DataRow("youtube", "https://WWW.YouTube.com/embed/x")]
    [DataRow("vimeo", "https://vimeo.com/1")]
    [DataRow("vimeo", "https://player.vimeo.com/video/1")]
    [DataRow("google_maps", "https://www.google.com/maps/embed?pb=1")]
    [DataRow("google_maps", "https://www.google.com/maps/embed/x")]
    public void An_url_of_its_provider_passes_AC3(string provider, string url) => Assert.IsNull(Check(Embed(provider, url)));

    [TestMethod]
    [DataRow("vimeo", "https://www.youtube.com/embed/x", "must be a Vimeo address")]
    [DataRow("youtube", "https://youtube.com.evil.example/x", "must be a YouTube address")]
    [DataRow("youtube", "https://user@evil.example/x", "must be a YouTube address")]
    [DataRow("google_maps", "https://www.google.com/search", "must be a Google Maps embed address")]
    [DataRow("google_maps", "https://google.com/maps/embed/x", "must be a Google Maps embed address")]
    public void An_url_of_another_host_is_refused_AC3(string provider, string url, string message)
    {
        AssertFails(Check(Embed(provider, url), 1), "/content/1/attrs/url", message);
    }

    [TestMethod]
    public void Ten_thousand_code_points_pass_and_one_more_fails_summed_over_text_nodes_AC4()
    {
        string Block(int first, int second) => RichText(Paragraph(Text(new string('a', first)), Text(new string('b', second))));

        Assert.IsNull(Check(Block(5000, 5000)));
        AssertFails(Check(Block(5000, 5001), 2), "/content/2/content");
    }

    [TestMethod]
    public void Code_points_are_counted_not_utf16_units_and_hard_breaks_count_zero_AC4()
    {
        var emoji = string.Concat(Enumerable.Repeat("😀", 5000));

        Assert.IsNull(Check(RichText(Paragraph(Text(emoji), """{"type":"hardBreak"}""", Text(emoji)))));
        AssertFails(Check(RichText(Paragraph(Text(emoji), Text(emoji), Text("a")))), "/content/0/content");
    }

    [TestMethod]
    public void Three_list_levels_pass_and_the_fourth_fails_at_the_fourth_list_AC5()
    {
        var third = List("bulletList", Item(Paragraph(Text("c"))));
        var second = List("orderedList", Item(Paragraph(Text("b")), third));
        var first = List("bulletList", Item(Paragraph(Text("a")), second));
        Assert.IsNull(Check(RichText(first)));

        var fourth = List("orderedList", Item(Paragraph(Text("d"))));
        var deep = List("bulletList", Item(Paragraph(Text("a")), List("orderedList", Item(Paragraph(Text("b")), List("bulletList", Item(Paragraph(Text("c")), fourth))))));
        AssertFails(Check(RichText(Paragraph(), deep)), "/content/0/content/1/content/0/content/1/content/0/content/1/content/0/content/1");
    }

    [TestMethod]
    [DataRow("bulletList")]
    [DataRow("orderedList")]
    public void A_list_directly_in_a_list_item_first_is_refused_at_that_child_AC6(string kind)
    {
        var block = RichText(List("bulletList", Item(List(kind, Item(Paragraph())))));

        AssertFails(Check(block), "/content/0/content/0/content/0/content/0");
    }

    [TestMethod]
    public void A_list_item_with_a_paragraph_first_and_a_nested_list_after_passes_AC6()
    {
        Assert.IsNull(Check(RichText(List("bulletList", Item(Paragraph(), List("orderedList", Item(Paragraph())))))));
    }

    [TestMethod]
    [DataRow("""{"type":"bold"},{"type":"bold"}""", "/content/0/content/0/content/0/marks/1")]
    [DataRow("""{"type":"italic"},{"type":"link","attrs":{"href":"/"}},{"type":"link","attrs":{"href":"/about"}}""", "/content/0/content/0/content/0/marks/2")]
    public void The_same_mark_twice_is_refused_at_the_second_AC7(string marks, string field)
    {
        AssertFails(Check(RichText(Paragraph(Text("a", marks)))), field);
    }

    [TestMethod]
    public void Different_marks_together_pass_AC7()
    {
        Assert.IsNull(Check(RichText(Paragraph(Text("a", """{"type":"bold"},{"type":"italic"},{"type":"link","attrs":{"href":"/"}}""")))));
    }

    [TestMethod]
    public void Html_and_the_extra_link_and_list_attributes_are_not_rules_AC8()
    {
        var link = """{"type":"link","attrs":{"href":"/","target":"_blank","rel":"noopener","class":"x"}}""";
        var ordered = """{"type":"orderedList","attrs":{"start":1,"type":"a"},"content":[{"type":"listItem","content":[{"type":"paragraph"}]}]}""";

        Assert.IsNull(Check(RichText(Paragraph(Text("<b>x</b><script>", link)), ordered)));
    }

    [TestMethod]
    public void The_rules_run_in_the_order_of_the_spec_AC9()
    {
        // In each block the failure of the later rule stands earlier in the document, so only the order of the rules decides.
        var doubleMark = Paragraph(Text("a", """{"type":"bold"},{"type":"bold"}"""));
        var listFirst = List("bulletList", Item(List("bulletList", Item(Paragraph()))));
        var tooDeep = Nest(4);
        var tooLong = Paragraph(Text(new string('a', 10_001)));

        // Link host before the mark.
        var host = RichText(Paragraph(Text("a", """{"type":"bold"},{"type":"bold"}"""), Text("b", """{"type":"link","attrs":{"href":"https://"}}""")));
        AssertFails(Check(host), "/content/0/content/0/content/1/marks/0/attrs/href");

        // Total text before depth, first child and marks.
        AssertFails(Check(RichText(tooDeep, listFirst, doubleMark, tooLong)), "/content/0/content");

        // Depth before first child and marks.
        AssertFails(Check(RichText(listFirst, doubleMark, tooDeep)), "/content/0/content/2" + string.Concat(Enumerable.Repeat("/content/0/content/1", 3)));

        // First child before marks.
        AssertFails(Check(RichText(doubleMark, listFirst)), "/content/0/content/1/content/0/content/0");
    }

    /// <summary>A bullet list that holds <paramref name="levels"/> lists one inside the other, each item a paragraph followed by the next list.</summary>
    private static string Nest(int levels) =>
        levels == 1 ? List("bulletList", Item(Paragraph(Text("x")))) : List(levels % 2 == 0 ? "orderedList" : "bulletList", Item(Paragraph(Text("x")), Nest(levels - 1)));

    [TestMethod]
    public void The_block_is_not_changed_AC10()
    {
        var block = JsonNode.Parse(RichText(Paragraph(Text("<b>"))))!.AsObject();
        var before = block.ToJsonString();

        BlockRules.Check(block, "/content/0");

        Assert.AreEqual(before, block.ToJsonString());
    }
}

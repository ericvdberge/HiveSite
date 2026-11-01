using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Hivesite.Content.Tests;

/// <summary>GET /block-types over HTTP (API-003).</summary>
[TestClass]
public sealed class BlockTypeTests
{
    private static List<string> Types(ApiResponse page) => page.Node("items").EnumerateArray().Select(i => i.GetProperty("type").GetString()!).ToList();

    [TestMethod]
    public async Task Lists_the_seven_block_types_in_order_with_their_texts_AC1()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), "/block-types");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
        var items = response.Node("items").EnumerateArray().ToList();
        CollectionAssert.AreEqual(BlockTypeSpec.Table.Select(t => t.Type).ToList(), Types(response));
        for (var i = 0; i < items.Count; i++)
        {
            Assert.AreEqual(BlockTypeSpec.Table[i].Name, items[i].GetProperty("name").GetString());
            Assert.AreEqual(BlockTypeSpec.Table[i].Description, items[i].GetProperty("description").GetString());
            Assert.AreEqual(1, items[i].GetProperty("version").GetInt32());
            Assert.AreEqual(JsonValueKind.Object, items[i].GetProperty("schema").ValueKind);
        }
        Assert.AreEqual(JsonValueKind.Null, response.Node("next_cursor").ValueKind);
    }

    [TestMethod]
    public async Task Every_served_schema_is_the_spec_schema_between_schema_and_defs_AC2()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), "/block-types");

        foreach (var item in response.Node("items").EnumerateArray())
        {
            var type = item.GetProperty("type").GetString()!;
            var schema = JsonNode.Parse(item.GetProperty("schema").GetRawText())!.AsObject();
            var keys = schema.Select(p => p.Key).ToList();
            Assert.AreEqual("$schema", keys[0], type);
            Assert.AreEqual("$defs", keys[^1], type);
            Assert.IsTrue(JsonNode.DeepEquals(BlockTypeSpec.Full(type), schema), $"{type}: schema differs from the spec.");
        }
    }

    [TestMethod]
    public async Task Paging_by_three_walks_the_registry_by_type_AC5()
    {
        var api = await ContentApi.ReadyAsync();
        var owner = ContentApi.NewOwner();

        var first = await api.GetAsync(owner, "/block-types?limit=3");
        var second = await api.GetAsync(owner, "/block-types?limit=3&cursor=image");
        var third = await api.GetAsync(owner, "/block-types?limit=3&cursor=contact_form");

        Assert.IsTrue(Types(first).SequenceEqual(["hero", "rich_text", "image"]));
        Assert.AreEqual("image", first.Text("next_cursor"));
        Assert.IsTrue(Types(second).SequenceEqual(["gallery", "card_list", "contact_form"]));
        Assert.AreEqual("contact_form", second.Text("next_cursor"));
        Assert.IsTrue(Types(third).SequenceEqual(["embed"]));
        Assert.AreEqual(JsonValueKind.Null, third.Node("next_cursor").ValueKind);
    }

    [TestMethod]
    [DataRow("1")]
    [DataRow("100")]
    public async Task Limits_1_and_100_are_accepted_AC6(string limit)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/block-types?limit={limit}");

        Assert.AreEqual(HttpStatusCode.OK, response.Status);
    }

    [TestMethod]
    [DataRow("0", true)]
    [DataRow("101", true)]
    [DataRow("-1", true)]
    [DataRow("abc", false)]
    [DataRow("", false)]
    public async Task A_bad_limit_is_refused_AC6(string limit, bool hasField)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/block-types?limit={limit}");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual(hasField ? "limit" : null, response.ErrorField);
    }

    [TestMethod]
    public async Task A_bad_limit_wins_over_a_bad_cursor_AC6()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), "/block-types?limit=0&cursor=nope");

        Assert.AreEqual("invalid_request", response.ErrorCode);
        Assert.AreEqual("limit", response.ErrorField);
    }

    [TestMethod]
    [DataRow("nope")]
    [DataRow("Hero")]
    [DataRow("")]
    public async Task An_unknown_cursor_is_refused_AC7(string cursor)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/block-types?cursor={cursor}");

        Assert.AreEqual(HttpStatusCode.BadRequest, response.Status);
        Assert.AreEqual("invalid_cursor", response.ErrorCode);
        Assert.AreEqual("cursor", response.ErrorField);
    }

    [TestMethod]
    public async Task Without_credentials_the_answer_is_401_AC8()
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.GetAsync(null, "/block-types");

        Assert.AreEqual(HttpStatusCode.Unauthorized, response.Status);
        Assert.AreEqual("unauthenticated", response.ErrorCode);
    }

    [TestMethod]
    public async Task Two_owners_get_the_same_body_AC9()
    {
        var api = await ContentApi.ReadyAsync();

        var one = await api.GetAsync(ContentApi.NewOwner(), "/block-types");
        var two = await api.GetAsync(ContentApi.NewOwner(), "/block-types");

        Assert.AreEqual(one.Body.GetRawText(), two.Body.GetRawText());
    }

    [TestMethod]
    [DataRow("POST", "/block-types")]
    [DataRow("PUT", "/block-types")]
    [DataRow("PATCH", "/block-types")]
    [DataRow("DELETE", "/block-types")]
    [DataRow("POST", "/block-types/hero")]
    [DataRow("PUT", "/block-types/hero")]
    [DataRow("PATCH", "/block-types/hero")]
    [DataRow("DELETE", "/block-types/hero")]
    public async Task Block_types_cannot_be_added_changed_or_removed_AC9(string method, string path)
    {
        var api = await ContentApi.ReadyAsync();

        var response = await api.SendAsync(new HttpMethod(method), path, ContentApi.NewOwner(), "{}");

        Assert.IsTrue(response.Status is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed, $"{method} {path} gave {response.Status}.");
    }
}

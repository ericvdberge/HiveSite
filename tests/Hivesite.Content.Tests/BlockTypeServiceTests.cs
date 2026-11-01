using Hivesite.Content.Application;
using Hivesite.Content.Domain;
using Hivesite.Content.Endpoints;
using Hivesite.Content.Infrastructure;

namespace Hivesite.Content.Tests;

/// <summary>The list rules, the limit validator and the query mapping. No PostgreSQL.</summary>
[TestClass]
public sealed class BlockTypeServiceTests
{
    private static readonly BlockTypeService Service = new(new BlockTypeRegistry());

    private static (List<string> Types, string? Next) Page(int limit, string? cursor = null)
    {
        var result = Service.List(new BlockTypeFilter { Limit = limit, Cursor = cursor });
        return (result.Value.Items.Select(t => t.Type).ToList(), BlockTypeMapper.ToDto(result.Value).NextCursor);
    }

    [TestMethod]
    public void Without_a_query_all_seven_come_back_without_a_next_cursor_AC1()
    {
        var (types, next) = Page(20);

        CollectionAssert.AreEqual(BlockTypeSpec.Table.Select(t => t.Type).ToList(), types);
        Assert.IsNull(next);
    }

    [TestMethod]
    public void Paging_by_three_walks_the_registry_by_type_AC5()
    {
        var first = Page(3);
        var second = Page(3, "image");
        var third = Page(3, "contact_form");

        Assert.IsTrue(first.Types.SequenceEqual(["hero", "rich_text", "image"]));
        Assert.AreEqual("image", first.Next);
        Assert.IsTrue(second.Types.SequenceEqual(["gallery", "card_list", "contact_form"]));
        Assert.AreEqual("contact_form", second.Next);
        Assert.IsTrue(third.Types.SequenceEqual(["embed"]));
        Assert.IsNull(third.Next);
    }

    [TestMethod]
    public void A_page_that_ends_exactly_at_the_last_type_has_no_next_cursor_AC5()
    {
        Assert.IsNull(Page(7).Next);
        Assert.IsNull(Page(2, "contact_form").Next);
    }

    [TestMethod]
    [DataRow("nope")]
    [DataRow("Hero")]
    [DataRow("")]
    public void An_unknown_cursor_is_refused_with_field_cursor_AC7(string cursor)
    {
        var result = Service.List(new BlockTypeFilter { Cursor = cursor });

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("invalid_cursor", result.Error.Code);
        Assert.AreEqual("cursor", result.Error.Field);
    }

    [TestMethod]
    public void The_query_maps_to_the_filter_AC5()
    {
        var filter = BlockTypeMapper.ToFilter(new BlockTypeQuery(3, "image"));

        Assert.AreEqual(3, filter.Limit);
        Assert.AreEqual("image", filter.Cursor);
    }

    [TestMethod]
    [DataRow(1, true)]
    [DataRow(100, true)]
    [DataRow(20, true)]
    [DataRow(0, false)]
    [DataRow(101, false)]
    [DataRow(-1, false)]
    public void The_limit_is_1_to_100_AC6(int limit, bool valid)
    {
        var result = new BlockTypeQueryValidator().Validate(new BlockTypeQuery(limit));

        Assert.AreEqual(valid, result.IsValid);
        if (!valid)
        {
            Assert.AreEqual("Limit", result.Errors[0].PropertyName);
        }
    }
}

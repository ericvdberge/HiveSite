using System.Net;

namespace Hivesite.Content.Tests;

[Collection(ContentApiDefinition.Name)]
public sealed class ReadSiteTests(ContentApi fixture)
{
    private static IEnumerable<string> Ids(ApiResponse page) => page.Node("items").EnumerateArray().Select(i => i.GetProperty("id").GetString()!);

    [Fact]
    public async Task Lists_only_own_sites_newest_first_AC12()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var oldest = (await api.CreateAsync(owner)).Text("id");
        api.Clock.Advance(TimeSpan.FromSeconds(2));
        var newest = (await api.CreateAsync(owner)).Text("id");
        await api.CreateAsync(ContentApi.NewOwner());

        var page = await api.GetAsync(owner, "/sites");

        Assert.Equal(HttpStatusCode.OK, page.Status);
        Assert.Equal([newest, oldest], Ids(page));
        Assert.Equal(System.Text.Json.JsonValueKind.Null, page.Node("next_cursor").ValueKind);
    }

    [Fact]
    public async Task An_owner_without_sites_gets_an_empty_page_AC12()
    {
        var api = await fixture.ReadyAsync();

        var page = await api.GetAsync(ContentApi.NewOwner(), "/sites");

        Assert.Equal(HttpStatusCode.OK, page.Status);
        Assert.Empty(page.Node("items").EnumerateArray());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, page.Node("next_cursor").ValueKind);
    }

    [Fact]
    public async Task Paging_shows_every_site_once_in_order_including_ties_AC13()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = new List<(string Id, string At)>();
        api.Clock.Freeze();
        try
        {
            for (var i = 0; i < 7; i++)
            {
                if (i == 4)
                {
                    api.Clock.Unfreeze();
                    api.Clock.Advance(TimeSpan.FromSeconds(5));
                    api.Clock.Freeze();
                }
                var site = await api.CreateAsync(owner);
                created.Add((site.Text("id"), site.Text("created_at")));
            }
        }
        finally
        {
            api.Clock.Unfreeze();
        }
        var expected = created.OrderByDescending(c => c.At, StringComparer.Ordinal).ThenBy(c => c.Id, StringComparer.Ordinal).Select(c => c.Id).ToList();

        var seen = new List<string>();
        var path = "/sites?limit=3";
        var pages = 0;
        while (path is not null)
        {
            var page = await api.GetAsync(owner, path);
            seen.AddRange(Ids(page));
            var next = page.Node("next_cursor");
            path = next.ValueKind == System.Text.Json.JsonValueKind.Null ? null : $"/sites?limit=3&cursor={Uri.EscapeDataString(next.GetString()!)}";
            pages++;
        }

        Assert.Equal(expected, seen);
        Assert.Equal(3, pages);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("101")]
    [InlineData("-1")]
    public async Task A_bad_limit_is_refused_AC14(string limit)
    {
        var api = await fixture.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/sites?limit={limit}");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_request", response.ErrorCode);
        Assert.Equal("limit", response.ErrorField);
    }

    [Fact]
    public async Task A_limit_that_is_not_a_number_is_refused_AC14()
    {
        var api = await fixture.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), "/sites?limit=abc");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_request", response.ErrorCode);
    }

    [Theory]
    [InlineData("1")]
    [InlineData("100")]
    public async Task Limits_1_and_100_are_accepted_AC14(string limit)
    {
        var api = await fixture.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/sites?limit={limit}");

        Assert.Equal(HttpStatusCode.OK, response.Status);
    }

    [Theory]
    [InlineData("garbage")]
    [InlineData("c_")]
    [InlineData("c_!!!")]
    [InlineData("c_bm90IGpzb24")]
    [InlineData("c_eyJjIjoibm9wZSJ9")]
    [InlineData("")]
    public async Task A_garbage_cursor_is_refused_AC15(string cursor)
    {
        var api = await fixture.ReadyAsync();

        var response = await api.GetAsync(ContentApi.NewOwner(), $"/sites?cursor={cursor}");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal("invalid_cursor", response.ErrorCode);
        Assert.Equal("cursor", response.ErrorField);
    }

    [Fact]
    public async Task A_well_formed_but_forged_cursor_is_refused_AC15()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        await api.CreateAsync(owner);
        await api.CreateAsync(owner);
        var payload = "{\"c\":\"2000-01-01T00:00:00Z\",\"i\":\"00000000-0000-0000-0000-000000000000\"}";
        var unsigned = "c_" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(payload)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var real = (await api.GetAsync(owner, "/sites?limit=1")).Node("next_cursor").GetString()!;
        var tampered = real[..^3] + (real.EndsWith("AAA", StringComparison.Ordinal) ? "BBB" : "AAA");

        foreach (var cursor in new[] { unsigned, tampered })
        {
            var response = await api.GetAsync(owner, $"/sites?cursor={Uri.EscapeDataString(cursor)}");

            Assert.Equal(HttpStatusCode.BadRequest, response.Status);
            Assert.Equal("invalid_cursor", response.ErrorCode);
            Assert.Equal("cursor", response.ErrorField);
        }
    }

    [Fact]
    public async Task A_cursor_from_another_owner_never_returns_their_data_AC15()
    {
        var api = await fixture.ReadyAsync();
        var a = ContentApi.NewOwner();
        var b = ContentApi.NewOwner();
        await api.CreateAsync(a);
        await api.CreateAsync(a);
        var mine = (await api.CreateAsync(b)).Text("id");
        var cursor = (await api.GetAsync(a, "/sites?limit=1")).Node("next_cursor").GetString()!;

        var page = await api.GetAsync(b, $"/sites?cursor={Uri.EscapeDataString(cursor)}");

        Assert.All(Ids(page), id => Assert.Equal(mine, id));
    }

    [Fact]
    public async Task Gets_a_site_by_id_in_any_case_AC16()
    {
        var api = await fixture.ReadyAsync();
        var owner = ContentApi.NewOwner();
        var created = await api.CreateAsync(owner, """{"language":"fr"}""");
        var id = created.Text("id");

        var lower = await api.GetAsync(owner, $"/sites/{id}");
        var upper = await api.GetAsync(owner, $"/sites/{id.ToUpperInvariant()}");

        Assert.Equal(HttpStatusCode.OK, lower.Status);
        Assert.Equal(created.Body.GetRawText(), lower.Body.GetRawText());
        Assert.Equal(id, upper.Text("id"));
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("other")]
    [InlineData("abc")]
    public async Task Unknown_foreign_and_malformed_ids_give_one_identical_404_AC17(string kind)
    {
        var api = await fixture.ReadyAsync();
        var foreign = (await api.CreateAsync(ContentApi.NewOwner())).Text("id");
        var id = kind switch { "missing" => Guid.CreateVersion7().ToString(), "other" => foreign, _ => "abc" };
        var baseline = await api.GetAsync(ContentApi.NewOwner(), $"/sites/{Guid.CreateVersion7()}");

        var get = await api.GetAsync(ContentApi.NewOwner(), $"/sites/{id}");
        var patch = await api.PatchAsync(ContentApi.NewOwner(), id, """{"name":"x"}""");

        Assert.Equal(HttpStatusCode.NotFound, get.Status);
        Assert.Equal("site_not_found", get.ErrorCode);
        Assert.Null(get.ErrorField);
        Assert.Equal(baseline.Body.GetRawText(), get.Body.GetRawText());
        Assert.Equal(HttpStatusCode.NotFound, patch.Status);
        Assert.Equal(baseline.Body.GetRawText(), patch.Body.GetRawText());
    }

    [Fact]
    public async Task Without_an_owner_GET_and_PATCH_are_unauthenticated_AC11()
    {
        var api = await fixture.ReadyAsync();
        var id = (await api.CreateAsync(ContentApi.NewOwner())).Text("id");

        var responses = new[]
        {
            await api.GetAsync(null, "/sites"),
            await api.GetAsync(null, $"/sites/{id}"),
            await api.PatchAsync(null, id, "{}"),
        };

        Assert.All(responses, r =>
        {
            Assert.Equal(HttpStatusCode.Unauthorized, r.Status);
            Assert.Equal("unauthenticated", r.ErrorCode);
            Assert.Null(r.ErrorField);
        });
    }
}

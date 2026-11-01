using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Hivesite.Host.Tests;

/// <summary>One endpoint of a spec under specs/content: its JSON example bodies and its documented error codes.</summary>
internal sealed record SpecEndpoint(string Method, string Path, IReadOnlyList<SpecBody> Bodies, IReadOnlyList<SpecError> Errors);

/// <summary><paramref name="Status"/> is null for a request body.</summary>
internal sealed record SpecBody(int? Status, string Json);

internal sealed record SpecError(int Status, string Code);

/// <summary>Reads the endpoint sections (<c>### POST /sites</c>) of a spec markdown file.</summary>
internal static partial class SpecExamples
{
    [GeneratedRegex(@"^### (GET|POST|PUT|PATCH|DELETE) (\S+)$")]
    private static partial Regex Heading();

    [GeneratedRegex(@"^Response (\d{3})\b")]
    private static partial Regex ResponseMarker();

    [GeneratedRegex(@"^- (\d{3}) `([a-z_]+)`")]
    private static partial Regex ErrorLine();

    [GeneratedRegex(@"^- \d{3}\b")]
    private static partial Regex ErrorLike();

    [GeneratedRegex(@"^status:\s*(\S.*?)\s*$")]
    private static partial Regex StatusLine();

    /// <summary>The <c>status</c> in the spec's front matter, e.g. <c>approved</c> or <c>in review</c>.</summary>
    public static string Status(string specFile)
    {
        foreach (var line in File.ReadLines(SpecPath(specFile)).Skip(1).TakeWhile(l => l != "---"))
        {
            if (StatusLine().Match(line) is { Success: true } m)
            {
                return m.Groups[1].Value;
            }
        }
        throw new FormatException($"{specFile}: no status in the front matter.");
    }

    /// <summary>
    /// The contract tests check approved and built specs against the running Host. A spec in review or draft
    /// describes code that is not built yet (a spec PR merges before its build PR), so it is skipped until then.
    /// </summary>
    public static void SkipUnlessApprovedOrBuilt(string specFile)
    {
        var status = Status(specFile);
        if (status is not ("approved" or "built"))
        {
            Assert.Inconclusive($"{specFile} is '{status}': its build PR sets it to built, and then these checks run.");
        }
    }

    public static IReadOnlyList<SpecEndpoint> Read(string specFile)
    {
        var endpoints = new List<SpecEndpoint>();
        string? method = null, path = null;
        List<SpecBody> bodies = [];
        List<SpecError> errors = [];
        int? marker = null;
        var markerSet = false;
        var inBody = false;
        var inErrors = false;
        List<string> json = [];

        void Flush()
        {
            if (method is not null)
            {
                endpoints.Add(new SpecEndpoint(method, path!, bodies, errors));
            }
        }

        foreach (var line in File.ReadLines(SpecPath(specFile)))
        {
            if (inBody)
            {
                if (line.StartsWith("```", StringComparison.Ordinal))
                {
                    inBody = false;
                    markerSet = false;
                    bodies.Add(new SpecBody(marker, string.Join('\n', json)));
                }
                else
                {
                    json.Add(line);
                }
                continue;
            }

            if (line == "Errors")
            {
                inErrors = true;
                continue;
            }

            if (inErrors && !line.StartsWith("- ", StringComparison.Ordinal))
            {
                inErrors = false;
            }

            if (inErrors && ErrorLike().IsMatch(line) && !ErrorLine().IsMatch(line))
            {
                throw new FormatException($"{specFile}: {method} {path}: error entry does not parse: {line}");
            }

            if (line.StartsWith("## ", StringComparison.Ordinal))
            {
                Flush();
                method = null;
            }
            else if (Heading().Match(line) is { Success: true } heading)
            {
                Flush();
                (method, path) = (heading.Groups[1].Value, heading.Groups[2].Value);
                (bodies, errors) = ([], []);
                markerSet = false;
            }
            else if (method is null)
            {
                continue;
            }
            else if (line == "Request")
            {
                (marker, markerSet) = (null, true);
            }
            else if (ResponseMarker().Match(line) is { Success: true } response)
            {
                (marker, markerSet) = (int.Parse(response.Groups[1].Value, CultureInfo.InvariantCulture), true);
            }
            else if (markerSet && line == "```json")
            {
                (inBody, json) = (true, []);
            }
            else if (ErrorLine().Match(line) is { Success: true } error)
            {
                errors.Add(new SpecError(int.Parse(error.Groups[1].Value, CultureInfo.InvariantCulture), error.Groups[2].Value));
            }
        }

        Flush();
        return endpoints;
    }

    private static string SpecPath(string specFile)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Hivesite.slnx")))
        {
            dir = dir.Parent;
        }
        Assert.IsNotNull(dir, "Hivesite.slnx not found above the test output folder.");
        return Path.Combine(dir.FullName, "specs", "content", specFile);
    }
}

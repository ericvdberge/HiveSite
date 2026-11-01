using System.Globalization;
using System.Text.RegularExpressions;

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

using System.Text.RegularExpressions;

namespace Hivesite.ArchitectureTests;

/// <summary>One C# file under src/ or one test project file, by its path from the repository root.</summary>
public sealed record SourceFile(string Path, string Text);

/// <summary>The rules of src/CLAUDE.md that a machine can check, so a reviewer doesn't have to.</summary>
public static partial class CodePatterns
{
    [GeneratedRegex(@"\bthrow\b")]
    private static partial Regex Throw();

    [GeneratedRegex(@"\b(FromSql\w*|ExecuteSql\w*|SqlQuery\w*)\s*\(")]
    private static partial Regex RawSql();

    [GeneratedRegex(@"\bHttpContext\b")]
    private static partial Regex HttpContext();

    [GeneratedRegex(@"\bDateTime(Offset)?\.(Utc)?Now\b")]
    private static partial Regex Clock();

    [GeneratedRegex(@"\bDbSet<(\w+)>")]
    private static partial Regex DbSet();

    [GeneratedRegex(@"Include=""xunit", RegexOptions.IgnoreCase)]
    private static partial Regex Xunit();

    public static IEnumerable<string> Violations(IEnumerable<SourceFile> files)
    {
        foreach (var file in files)
        {
            var path = file.Path.Replace('\\', '/');
            if (path.EndsWith(".csproj", StringComparison.Ordinal))
            {
                if (Xunit().IsMatch(file.Text))
                {
                    yield return $"{path}: tests use MSTest, not xUnit.";
                }
                continue;
            }
            if (!path.Contains("/Modules/", StringComparison.Ordinal) || path.Contains("/Migrations/", StringComparison.Ordinal))
            {
                continue;
            }

            if ((path.Contains("/Application/", StringComparison.Ordinal) || path.EndsWith("Repository.cs", StringComparison.Ordinal)) && Throw().IsMatch(file.Text))
            {
                yield return $"{path}: no exceptions for business logic; return null or a Result<T>.";
            }
            if (RawSql().IsMatch(file.Text))
            {
                yield return $"{path}: always LINQ over the DbSet, no raw SQL.";
            }
            if (path.Contains("/Endpoints/", StringComparison.Ordinal) && HttpContext().IsMatch(file.Text))
            {
                yield return $"{path}: endpoints bind DTOs, never HttpContext.";
            }
            if (Clock().IsMatch(file.Text))
            {
                yield return $"{path}: use ITimeService, never the system clock.";
            }
            foreach (Match set in DbSet().Matches(file.Text))
            {
                if (!set.Groups[1].Value.EndsWith("Dao", StringComparison.Ordinal))
                {
                    yield return $"{path}: EF Core maps DAOs only, not {set.Groups[1].Value}.";
                }
            }
        }
    }

    public static IReadOnlyList<SourceFile> LoadFromRepository()
    {
        var root = ModuleBoundaries.RepositoryRoot();
        var code = Directory.EnumerateFiles(Path.Combine(root, "src"), "*.cs", SearchOption.AllDirectories);
        var tests = Directory.EnumerateFiles(Path.Combine(root, "tests"), "*.csproj", SearchOption.AllDirectories);
        return code.Concat(tests)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                && !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Select(f => new SourceFile(Path.GetRelativePath(root, f), File.ReadAllText(f)))
            .ToList();
    }
}

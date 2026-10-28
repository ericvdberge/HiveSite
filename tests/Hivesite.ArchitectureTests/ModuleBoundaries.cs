using System.Xml.Linq;

namespace Hivesite.ArchitectureTests;

public enum ProjectKind { Host, Shared, Contracts, Module }

/// <summary>One project under src/, with what it references.</summary>
public sealed record SourceProject(string Name, IReadOnlyList<string> ProjectReferences, IReadOnlyList<string> PackageReferences)
{
    public ProjectKind? Kind => Name switch
    {
        "Hivesite.Host" => ProjectKind.Host,
        "Hivesite.Shared" => ProjectKind.Shared,
        _ when ModuleBoundaries.Modules.Any(m => Name == $"Hivesite.{m}.Contracts") => ProjectKind.Contracts,
        _ when ModuleBoundaries.Modules.Any(m => Name == $"Hivesite.{m}") => ProjectKind.Module,
        _ => null,
    };
}

/// <summary>The rules of ADR 1: modules talk only through their <c>.Contracts</c> projects.</summary>
public static class ModuleBoundaries
{
    public static readonly IReadOnlyList<string> Modules = ["Content", "Rendering", "Publishing"];

    // Rendering is pure (CLAUDE.md): content + theme → HTML, no database.
    private static readonly string[] DatabasePackages = ["Microsoft.EntityFrameworkCore", "Npgsql"];

    public static IEnumerable<string> Violations(IReadOnlyList<SourceProject> projects)
    {
        var kinds = projects.ToDictionary(p => p.Name, p => p.Kind);

        foreach (var project in projects)
        {
            if (project.Kind is not { } kind)
            {
                yield return $"{project.Name} is not a known project kind (Host, Shared, a module or its Contracts).";
                continue;
            }

            foreach (var reference in project.ProjectReferences)
            {
                var target = kinds.GetValueOrDefault(reference);
                var allowed = kind switch
                {
                    ProjectKind.Host => true,
                    ProjectKind.Contracts => target == ProjectKind.Shared,
                    ProjectKind.Module => target is ProjectKind.Shared or ProjectKind.Contracts,
                    _ => false,
                };
                if (!allowed)
                {
                    yield return $"{project.Name} must not reference {reference}.";
                }
            }

            if (project.Name.StartsWith("Hivesite.Rendering", StringComparison.Ordinal))
            {
                foreach (var package in project.PackageReferences.Where(p => DatabasePackages.Any(d => p.StartsWith(d, StringComparison.Ordinal))))
                {
                    yield return $"{project.Name} must not reference {package}: Rendering has no database.";
                }
            }
        }
    }

    public static IReadOnlyList<SourceProject> LoadFromRepository()
    {
        var src = Path.Combine(RepositoryRoot(), "src");
        return Directory.EnumerateFiles(src, "*.csproj", SearchOption.AllDirectories)
            .Select(Load)
            .ToList();
    }

    private static SourceProject Load(string path)
    {
        var xml = XDocument.Load(path);
        List<string> Includes(string element) => xml.Descendants(element)
            .Select(e => (string?)e.Attribute("Include"))
            .OfType<string>()
            .ToList();

        return new SourceProject(
            Path.GetFileNameWithoutExtension(path),
            Includes("ProjectReference").Select(r => Path.GetFileNameWithoutExtension(r.Replace('\\', '/'))).ToList(),
            Includes("PackageReference"));
    }

    private static string RepositoryRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Hivesite.slnx")))
        {
            dir = dir.Parent;
        }
        return dir?.FullName ?? throw new InvalidOperationException("Hivesite.slnx not found above the test output folder.");
    }
}

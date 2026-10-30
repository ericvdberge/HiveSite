namespace Hivesite.ArchitectureTests;

[TestClass]
public sealed class CodePatternTests
{
    [TestMethod]
    public void The_solution_follows_the_checked_patterns()
    {
        var violations = CodePatterns.Violations(CodePatterns.LoadFromRepository()).ToList();

        Assert.IsEmpty(violations, string.Join(Environment.NewLine, violations));
    }

    [TestMethod]
    [DataRow("src/Modules/Content/Hivesite.Content/Application/SiteService.cs", "throw new InvalidOperationException();")]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/SiteRepository.cs", "throw new SlugTakenException();")]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/SiteRepository.cs", "db.Database.ExecuteSqlRaw(\"delete\");")]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/SiteRepository.cs", "db.Sites.FromSql($\"select 1\")")]
    [DataRow("src/Modules/Content/Hivesite.Content/Endpoints/SiteEndpoints.cs", "static Task Create(HttpContext context)")]
    [DataRow("src/Modules/Content/Hivesite.Content/Application/SiteService.cs", "site.CreatedAt = DateTime.UtcNow;")]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/ContentDbContext.cs", "public DbSet<Site> Sites => Set<Site>();")]
    [DataRow("tests/Hivesite.Content.Tests/Hivesite.Content.Tests.csproj", "<PackageReference Include=\"xunit.v3\" />")]
    public void A_broken_pattern_is_a_violation(string path, string text)
    {
        var violations = CodePatterns.Violations([new SourceFile(path, text)]);

        Assert.HasCount(1, violations);
    }

    [TestMethod]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/ContentDbContext.cs", "public DbSet<SiteDao> Sites => Set<SiteDao>();")]
    [DataRow("src/Modules/Content/Hivesite.Content/Endpoints/SiteEndpoints.cs", "throw new InvalidOperationException();")]
    [DataRow("src/Modules/Content/Hivesite.Content/Infrastructure/Migrations/20261030_CreateSites.cs", "migrationBuilder.Sql(\"select 1\");")]
    [DataRow("src/Hivesite.Shared/UserContext.cs", "throw new InvalidOperationException();")]
    [DataRow("tests/Hivesite.Content.Tests/Hivesite.Content.Tests.csproj", "<PackageReference Include=\"MSTest\" />")]
    public void Allowed_code_is_no_violation(string path, string text)
    {
        var violations = CodePatterns.Violations([new SourceFile(path, text)]);

        Assert.IsEmpty(violations);
    }
}

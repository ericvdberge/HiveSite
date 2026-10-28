namespace Hivesite.ArchitectureTests;

public sealed class ModuleBoundaryTests
{
    [Fact]
    public void The_solution_breaks_no_module_boundary()
    {
        var violations = ModuleBoundaries.Violations(ModuleBoundaries.LoadFromRepository());

        Assert.Empty(violations);
    }

    [Fact]
    public void Every_module_has_a_project_and_a_contracts_project()
    {
        var names = ModuleBoundaries.LoadFromRepository().Select(p => p.Name).ToHashSet();

        Assert.All(ModuleBoundaries.Modules, m =>
        {
            Assert.Contains($"Hivesite.{m}", names);
            Assert.Contains($"Hivesite.{m}.Contracts", names);
        });
    }

    [Theory]
    [InlineData("Hivesite.Content", "Hivesite.Publishing")]
    [InlineData("Hivesite.Publishing", "Hivesite.Rendering")]
    [InlineData("Hivesite.Content.Contracts", "Hivesite.Content")]
    [InlineData("Hivesite.Content.Contracts", "Hivesite.Rendering.Contracts")]
    [InlineData("Hivesite.Shared", "Hivesite.Content.Contracts")]
    [InlineData("Hivesite.Content", "Hivesite.Host")]
    public void A_reference_to_another_modules_internals_is_a_violation(string from, string to)
    {
        var violations = ModuleBoundaries.Violations([Project(from, to), Project(to)]);

        Assert.Equal([$"{from} must not reference {to}."], violations);
    }

    [Theory]
    [InlineData("Hivesite.Content", "Hivesite.Shared")]
    [InlineData("Hivesite.Content", "Hivesite.Content.Contracts")]
    [InlineData("Hivesite.Publishing", "Hivesite.Content.Contracts")]
    [InlineData("Hivesite.Rendering.Contracts", "Hivesite.Shared")]
    [InlineData("Hivesite.Host", "Hivesite.Publishing")]
    public void A_reference_through_contracts_or_shared_is_allowed(string from, string to)
    {
        var violations = ModuleBoundaries.Violations([Project(from, to), Project(to)]);

        Assert.Empty(violations);
    }

    [Theory]
    [InlineData("Npgsql")]
    [InlineData("Microsoft.EntityFrameworkCore")]
    [InlineData("Npgsql.EntityFrameworkCore.PostgreSQL")]
    public void Rendering_with_a_database_package_is_a_violation(string package)
    {
        var rendering = new SourceProject("Hivesite.Rendering", [], [package]);

        var violations = ModuleBoundaries.Violations([rendering]);

        Assert.Single(violations);
    }

    [Fact]
    public void An_unknown_project_under_src_is_a_violation()
    {
        var violations = ModuleBoundaries.Violations([Project("Hivesite.Utilities")]);

        Assert.Single(violations);
    }

    private static SourceProject Project(string name, params string[] references) => new(name, references, []);
}

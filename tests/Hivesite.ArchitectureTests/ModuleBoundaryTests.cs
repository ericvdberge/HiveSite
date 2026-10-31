namespace Hivesite.ArchitectureTests;

[TestClass]
public sealed class ModuleBoundaryTests
{
    [TestMethod]
    public void The_solution_breaks_no_module_boundary()
    {
        var violations = ModuleBoundaries.Violations(ModuleBoundaries.LoadFromRepository());

        Assert.IsEmpty(violations);
    }

    [TestMethod]
    public void Every_module_has_a_project_and_a_contracts_project()
    {
        var names = ModuleBoundaries.LoadFromRepository().Select(p => p.Name).ToHashSet();

        foreach (var m in ModuleBoundaries.Modules)
        {
            Assert.Contains($"Hivesite.{m}", names);
            Assert.Contains($"Hivesite.{m}.Contracts", names);
        }
    }

    [TestMethod]
    [DataRow("Hivesite.Content", "Hivesite.Publishing")]
    [DataRow("Hivesite.Publishing", "Hivesite.Rendering")]
    [DataRow("Hivesite.Content.Contracts", "Hivesite.Content")]
    [DataRow("Hivesite.Content.Contracts", "Hivesite.Rendering.Contracts")]
    [DataRow("Hivesite.Shared", "Hivesite.Content.Contracts")]
    [DataRow("Hivesite.Content", "Hivesite.Host")]
    public void A_reference_to_another_modules_internals_is_a_violation(string from, string to)
    {
        var violations = ModuleBoundaries.Violations([Project(from, to), Project(to)]);

        CollectionAssert.AreEqual(new[] { $"{from} must not reference {to}." }, violations.ToList());
    }

    [TestMethod]
    [DataRow("Hivesite.Content", "Hivesite.Shared")]
    [DataRow("Hivesite.Content", "Hivesite.Content.Contracts")]
    [DataRow("Hivesite.Publishing", "Hivesite.Content.Contracts")]
    [DataRow("Hivesite.Rendering.Contracts", "Hivesite.Shared")]
    [DataRow("Hivesite.Host", "Hivesite.Publishing")]
    public void A_reference_through_contracts_or_shared_is_allowed(string from, string to)
    {
        var violations = ModuleBoundaries.Violations([Project(from, to), Project(to)]);

        Assert.IsEmpty(violations);
    }

    [TestMethod]
    [DataRow("Npgsql")]
    [DataRow("Microsoft.EntityFrameworkCore")]
    [DataRow("Npgsql.EntityFrameworkCore.PostgreSQL")]
    public void Rendering_with_a_database_package_is_a_violation(string package)
    {
        var rendering = new SourceProject("Hivesite.Rendering", [], [package]);

        var violations = ModuleBoundaries.Violations([rendering]);

        Assert.HasCount(1, violations);
    }

    [TestMethod]
    public void An_unknown_project_under_src_is_a_violation()
    {
        var violations = ModuleBoundaries.Violations([Project("Hivesite.Utilities")]);

        Assert.HasCount(1, violations);
    }

    private static SourceProject Project(string name, params string[] references) => new(name, references, []);
}

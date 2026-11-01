using Hivesite.Content.Endpoints;

namespace Hivesite.Content.Tests;

[TestClass]
public sealed class BlockTypeValidatorTests
{
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

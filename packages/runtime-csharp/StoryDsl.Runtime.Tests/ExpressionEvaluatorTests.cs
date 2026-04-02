using StoryDsl.Runtime;

namespace StoryDsl.Runtime.Tests;

public sealed class ExpressionEvaluatorTests
{
    [Fact]
    public async Task EvaluateAsync_ReturnsVariableValue()
    {
        var host = new TestRuntimeHost();
        host.Variables["money"] = ExprValue.FromNumber(42);

        var result = await ExpressionEvaluator.EvaluateAsync(new VariableExprNode("money"), host, CancellationToken.None);

        Assert.Equal(42, result.AsNumber("test"));
    }

    [Fact]
    public async Task EvaluateAsync_ShortCircuitsAnd()
    {
        var host = new TestRuntimeHost();
        host.Predicates["expensive"] = _ => throw new InvalidOperationException("should not run");

        var expr = new BinaryExprNode(
            ExprBinaryOperator.And,
            new LiteralExprNode(ExprValue.FromBoolean(false)),
            new PredicateExprNode("expensive", Array.Empty<ExprNode>()));

        var result = await ExpressionEvaluator.EvaluateAsync(expr, host, CancellationToken.None);

        Assert.False(result.AsBoolean("test"));
        Assert.Equal(0, host.PredicateCalls);
    }

    [Fact]
    public async Task EvaluateAsync_ComparesNumbers()
    {
        var host = new TestRuntimeHost();
        host.Variables["money"] = ExprValue.FromNumber(99);

        var expr = new BinaryExprNode(
            ExprBinaryOperator.GreaterThan,
            new VariableExprNode("money"),
            new LiteralExprNode(ExprValue.FromNumber(10)));

        var result = await ExpressionEvaluator.EvaluateAsync(expr, host, CancellationToken.None);

        Assert.True(result.AsBoolean("test"));
    }

    [Fact]
    public async Task EvaluateAsync_RejectsMixedTypeEquality()
    {
        var host = new TestRuntimeHost();
        var expr = new BinaryExprNode(
            ExprBinaryOperator.Equal,
            new LiteralExprNode(ExprValue.FromBoolean(true)),
            new LiteralExprNode(ExprValue.FromString("true")));

        await Assert.ThrowsAsync<StoryRuntimeException>(
            async () => await ExpressionEvaluator.EvaluateAsync(expr, host, CancellationToken.None));
    }
}

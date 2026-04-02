using StoryDsl.Runtime;

namespace StoryDsl.Runtime.Tests;

public sealed class JsonParsingTests
{
    [Fact]
    public void Parse_ReadsBranchAndExpressionShapes()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                {
                  "kind": "branch",
                  "cases": [
                    {
                      "when": ["and", ["pred", "has_item", "knife"], [">", ["var", "money"], 10]],
                      "steps": [
                        { "kind": "dialogue", "speaker": "npc", "text": "rich" }
                      ]
                    }
                  ],
                  "fallback": [
                    { "kind": "jump", "target": "End" }
                  ]
                }
              ]
            },
            {
              "name": "End",
              "steps": []
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);

        Assert.Equal(1, script.Version);
        Assert.Equal(2, script.Segments.Count);
        var segment = script.Segments[0];
        Assert.Equal("Start", segment.Name);

        var branch = Assert.IsType<BranchStep>(Assert.Single(segment.Steps));
        var branchCase = Assert.Single(branch.Cases);
        var condition = Assert.IsType<BinaryExprNode>(branchCase.When);
        Assert.Equal(ExprBinaryOperator.And, condition.Operator);

        var left = Assert.IsType<PredicateExprNode>(condition.Left);
        Assert.Equal("has_item", left.Name);
        var arg = Assert.IsType<LiteralExprNode>(Assert.Single(left.Arguments));
        Assert.Equal("knife", arg.Value.AsString("test"));

        var right = Assert.IsType<BinaryExprNode>(condition.Right);
        Assert.Equal(ExprBinaryOperator.GreaterThan, right.Operator);
        var variable = Assert.IsType<VariableExprNode>(right.Left);
        Assert.Equal("money", variable.Name);

        var fallback = Assert.IsType<JumpStep>(Assert.Single(branch.Fallback!));
        Assert.Equal("End", fallback.Target);
    }

    [Fact]
    public void Parse_ReadsCommandValueArgs()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                {
                  "kind": "command",
                  "name": "set_reward",
                  "args": [["var", "moneyCnt"], "小刀", 2]
                }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);

        var command = Assert.IsType<CommandStep>(Assert.Single(script.Segments[0].Steps));
        var variable = Assert.IsType<VariableExprNode>(command.Args[0]);
        Assert.Equal("moneyCnt", variable.Name);
        var item = Assert.IsType<LiteralExprNode>(command.Args[1]);
        Assert.Equal("小刀", item.Value.AsString("test"));
        var count = Assert.IsType<LiteralExprNode>(command.Args[2]);
        Assert.Equal(2, count.Value.AsNumber("test"));
    }
}

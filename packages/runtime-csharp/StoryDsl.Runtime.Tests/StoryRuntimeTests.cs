using StoryDsl.Runtime;

namespace StoryDsl.Runtime.Tests;

public sealed class StoryRuntimeTests
{
    [Fact]
    public async Task RunAsync_UsesFallbackWhenNoBranchMatches()
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
                      "when": ["pred", "always_false"],
                      "steps": [
                        { "kind": "dialogue", "speaker": "npc", "text": "wrong" }
                      ]
                    }
                  ],
                  "fallback": [
                    { "kind": "dialogue", "speaker": "npc", "text": "fallback" }
                  ]
                }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var host = new TestRuntimeHost();
        host.Predicates["always_false"] = _ => false;
        var runtime = new StoryRuntime();

        var events = await CollectAsync(runtime.RunAsync(script, host));

        var dialogue = Assert.IsType<DialogueEvent>(Assert.Single(events));
        Assert.Equal("fallback", dialogue.Text);
    }

    [Fact]
    public async Task RunAsync_JumpsToTargetSegment()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                { "kind": "jump", "target": "End" }
              ]
            },
            {
              "name": "End",
              "steps": [
                { "kind": "dialogue", "speaker": "npc", "text": "done" }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();

        var events = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Collection(
            events,
            item => Assert.IsType<JumpEvent>(item),
            item =>
            {
                var dialogue = Assert.IsType<DialogueEvent>(item);
                Assert.Equal("done", dialogue.Text);
            });
    }

    [Fact]
    public async Task RunAsync_ExecutesDemoScript()
    {
        var jsonPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "demo.story.json"));
        var script = await StoryScriptJson.LoadFromFileAsync(jsonPath);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();
        host.Variables["money"] = ExprValue.FromNumber(120);
        host.Predicates["has_item"] = args => args.Count == 1 && args[0].AsString("pred arg") == "小刀";
        host.ChoiceSelections.Enqueue(1);
        host.BattleOutcomes.Enqueue(BattleOutcome.Timeout);

        var events = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Contains(events, item => item is ChoiceOfferedEvent);
        Assert.Contains(events, item => item is ChoiceResolvedEvent resolved && resolved.SelectedIndex == 1);
        Assert.Contains(events, item => item is BattleStartedEvent);
        Assert.Contains(events, item => item is BattleResolvedEvent resolved && resolved.Outcome == BattleOutcome.Timeout);
        Assert.Contains(events, item => item is DialogueEvent dialogue && dialogue.Text == "给你钱");
        Assert.Contains(events, item => item is DialogueEvent dialogue && dialogue.Text == "不错");
        Assert.DoesNotContain(events, item => item is DialogueEvent dialogue && dialogue.Text == "穷鬼");
        Assert.Contains("get_money:100", host.Commands);
    }

    [Fact]
    public async Task RunAsync_EvaluatesCommandVariableArgs()
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
                  "name": "get_item",
                  "args": [["var", "ItemName"]]
                }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();
        host.Variables["ItemName"] = ExprValue.FromString("小刀");

        var events = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Contains("get_item:小刀", host.Commands);
        var commandEvent = Assert.IsType<CommandExecutedEvent>(Assert.Single(events));
        Assert.Equal("小刀", Assert.Single(commandEvent.Args).AsString("command arg"));
    }

    private static async Task<List<RuntimeEvent>> CollectAsync(IAsyncEnumerable<RuntimeEvent> source)
    {
        var events = new List<RuntimeEvent>();
        await foreach (var item in source)
        {
            events.Add(item);
        }

        return events;
    }
}

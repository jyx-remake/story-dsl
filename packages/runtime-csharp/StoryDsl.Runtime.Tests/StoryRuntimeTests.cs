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

        var dialogue = Assert.IsType<DialogueReadyEvent>(Assert.Single(events));
        Assert.Equal("fallback", dialogue.Dialogue.Text);
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
                var dialogue = Assert.IsType<DialogueReadyEvent>(item);
                Assert.Equal("done", dialogue.Dialogue.Text);
            });
    }

    [Fact]
    public async Task RunAsync_CallReturnsToCallerAndContinuesNextStep()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                { "kind": "command", "name": "mark", "args": ["before_call"] },
                { "kind": "call", "target": "Shared" },
                { "kind": "command", "name": "mark", "args": ["after_call"] }
              ]
            },
            {
              "name": "Shared",
              "steps": [
                { "kind": "command", "name": "mark", "args": ["inside_call"] },
                { "kind": "return" },
                { "kind": "command", "name": "mark", "args": ["after_return"] }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();

        _ = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Equal(
            ["mark:before_call", "mark:inside_call", "mark:after_call"],
            host.Commands);
    }

    [Fact]
    public async Task RunAsync_TopLevelReturnEndsStoryFlow()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                { "kind": "command", "name": "mark", "args": ["before_return"] },
                { "kind": "return" },
                { "kind": "command", "name": "mark", "args": ["after_return"] }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();

        _ = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Equal(["mark:before_return"], host.Commands);
    }

    [Fact]
    public async Task RunAsync_JumpInsideCalledSegmentDoesNotReturnToCaller()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                { "kind": "call", "target": "Shared" },
                { "kind": "command", "name": "mark", "args": ["after_call"] }
              ]
            },
            {
              "name": "Shared",
              "steps": [
                { "kind": "jump", "target": "Target" }
              ]
            },
            {
              "name": "Target",
              "steps": [
                { "kind": "command", "name": "mark", "args": ["landed"] }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();

        var events = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Equal(["mark:landed"], host.Commands);
        Assert.Contains(events, item => item is JumpEvent jump && jump.Target == "Target");
    }

    [Fact]
    public async Task RunAsync_WaitsOnHostForEachDialogue()
    {
        const string json = """
        {
          "version": 1,
          "segments": [
            {
              "name": "Start",
              "steps": [
                { "kind": "dialogue", "speaker": "npc", "text": "first" },
                { "kind": "dialogue", "speaker": "npc", "text": "second" }
              ]
            }
          ]
        }
        """;

        var script = StoryScriptJson.Parse(json);
        var runtime = new StoryRuntime();
        var host = new TestRuntimeHost();

        var events = await CollectAsync(runtime.RunAsync(script, host));

        Assert.Equal(2, host.DialogueCalls);
        Assert.Collection(
            events,
            item => Assert.Equal("first", Assert.IsType<DialogueReadyEvent>(item).Dialogue.Text),
            item => Assert.Equal("second", Assert.IsType<DialogueReadyEvent>(item).Dialogue.Text));
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
        Assert.Contains(events, item => item is DialogueReadyEvent dialogue && dialogue.Dialogue.Text == "给你钱");
        Assert.Contains(events, item => item is DialogueReadyEvent dialogue && dialogue.Dialogue.Text == "不错");
        Assert.DoesNotContain(events, item => item is DialogueReadyEvent dialogue && dialogue.Dialogue.Text == "穷鬼");
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

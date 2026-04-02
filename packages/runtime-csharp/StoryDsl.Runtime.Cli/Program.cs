using StoryDsl.Runtime;
using StoryDsl.Runtime.Cli;

if (args.Length == 0)
{
    Console.Error.WriteLine("Usage: StoryDsl.Runtime.Cli <path-to-story.json> [--start <segment-name>]");
    return 1;
}

var filePath = args[0];
string? startSegment = null;

for (var index = 1; index < args.Length; index += 1)
{
    if (!string.Equals(args[index], "--start", StringComparison.Ordinal))
    {
        Console.Error.WriteLine($"Unknown argument '{args[index]}'.");
        return 1;
    }

    if (index + 1 >= args.Length)
    {
        Console.Error.WriteLine("Missing segment name after --start.");
        return 1;
    }

    startSegment = args[index + 1];
    index += 1;
}

try
{
    var script = await StoryScriptJson.LoadFromFileAsync(filePath);
    var runtime = new StoryRuntime();
    var host = new ConsoleRuntimeHost();

    await foreach (var runtimeEvent in runtime.RunAsync(script, host, startSegment))
    {
        Print(runtimeEvent);
    }

    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine(ex.Message);
    return 1;
}

static void Print(RuntimeEvent runtimeEvent)
{
    switch (runtimeEvent)
    {
        case DialogueEvent dialogue:
            Console.WriteLine($"DIALOGUE {dialogue.Speaker}: {dialogue.Text}");
            break;
        case CommandExecutedEvent command:
            Console.WriteLine($"COMMAND {command.Name} [{string.Join(", ", command.Args.Select(arg => arg.ToString()))}]");
            break;
        case ChoiceOfferedEvent choice:
            Console.WriteLine($"CHOICE {choice.Choice.PromptSpeaker}: {choice.Choice.PromptText}");
            foreach (var option in choice.Choice.Options)
            {
                Console.WriteLine($"  [{option.Index}] {option.Text}");
            }

            break;
        case ChoiceResolvedEvent choice:
            Console.WriteLine($"CHOICE-RESOLVED {choice.SelectedIndex}");
            break;
        case BattleStartedEvent battle:
            Console.WriteLine($"BATTLE {battle.Battle.BattleId} [{string.Join(", ", battle.Battle.AvailableOutcomes.Select(FormatBattleOutcome))}]");
            break;
        case BattleResolvedEvent battle:
            Console.WriteLine($"BATTLE-RESOLVED {battle.Battle.BattleId}: {FormatBattleOutcome(battle.Outcome)}");
            break;
        case JumpEvent jump:
            Console.WriteLine($"JUMP {jump.Target}");
            break;
        default:
            Console.WriteLine(runtimeEvent);
            break;
    }
}

static string FormatBattleOutcome(BattleOutcome outcome) => outcome switch
{
    BattleOutcome.Win => "win",
    BattleOutcome.Lose => "lose",
    BattleOutcome.Timeout => "timeout",
    _ => outcome.ToString().ToLowerInvariant(),
};

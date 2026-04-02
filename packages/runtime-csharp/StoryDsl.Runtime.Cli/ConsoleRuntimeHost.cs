using System.Globalization;
using StoryDsl.Runtime;

namespace StoryDsl.Runtime.Cli;

internal sealed class ConsoleRuntimeHost : IRuntimeHost
{
    private readonly Dictionary<string, ExprValue> _variables = new(StringComparer.Ordinal);

    public ValueTask<ExprValue> GetVariableAsync(string name, CancellationToken cancellationToken)
    {
        if (_variables.TryGetValue(name, out var value))
        {
            return ValueTask.FromResult(value);
        }

        cancellationToken.ThrowIfCancellationRequested();
        Console.Write($"Variable '{name}' value (bool/number/string): ");
        var input = Console.ReadLine();
        if (input is null)
        {
            throw new OperationCanceledException("Console input ended while waiting for a variable.");
        }

        value = ParseValue(input);
        _variables[name] = value;
        return ValueTask.FromResult(value);
    }

    public ValueTask<bool> EvaluatePredicateAsync(string name, IReadOnlyList<ExprValue> args, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Console.WriteLine($"Predicate {name}({string.Join(", ", args.Select(arg => arg.ToString()))})");

        while (true)
        {
            Console.Write("Predicate result (true/false): ");
            var input = Console.ReadLine();
            if (input is null)
            {
                throw new OperationCanceledException("Console input ended while waiting for a predicate result.");
            }

            if (bool.TryParse(input.Trim(), out var value))
            {
                return ValueTask.FromResult(value);
            }

            Console.WriteLine("Expected 'true' or 'false'.");
        }
    }

    public ValueTask ExecuteCommandAsync(string name, IReadOnlyList<ExprValue> args, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Console.WriteLine($"Command {name}({string.Join(", ", args.Select(arg => arg.ToString()))})");
        return ValueTask.CompletedTask;
    }

    public ValueTask<int> ChooseOptionAsync(ChoiceContext choice, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        while (true)
        {
            Console.Write("Choose option index: ");
            var input = Console.ReadLine();
            if (input is null)
            {
                throw new OperationCanceledException("Console input ended while waiting for a choice.");
            }

            if (int.TryParse(input.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var index) &&
                index >= 0 &&
                index < choice.Options.Count)
            {
                return ValueTask.FromResult(index);
            }

            Console.WriteLine($"Expected an integer between 0 and {choice.Options.Count - 1}.");
        }
    }

    public ValueTask<BattleOutcome> ResolveBattleAsync(BattleContext battle, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        while (true)
        {
            Console.Write("Battle outcome (win/lose/timeout): ");
            var input = Console.ReadLine();
            if (input is null)
            {
                throw new OperationCanceledException("Console input ended while waiting for a battle outcome.");
            }

            if (TryParseBattleOutcome(input.Trim(), out var outcome) && battle.AvailableOutcomes.Contains(outcome))
            {
                return ValueTask.FromResult(outcome);
            }

            Console.WriteLine($"Expected one of: {string.Join(", ", battle.AvailableOutcomes.Select(FormatBattleOutcome))}.");
        }
    }

    private static ExprValue ParseValue(string input)
    {
        if (bool.TryParse(input.Trim(), out var booleanValue))
        {
            return ExprValue.FromBoolean(booleanValue);
        }

        if (double.TryParse(input.Trim(), NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var numberValue))
        {
            return ExprValue.FromNumber(numberValue);
        }

        return ExprValue.FromString(input);
    }

    private static bool TryParseBattleOutcome(string input, out BattleOutcome outcome)
    {
        switch (input.ToLowerInvariant())
        {
            case "win":
                outcome = BattleOutcome.Win;
                return true;
            case "lose":
                outcome = BattleOutcome.Lose;
                return true;
            case "timeout":
                outcome = BattleOutcome.Timeout;
                return true;
            default:
                outcome = default;
                return false;
        }
    }

    private static string FormatBattleOutcome(BattleOutcome outcome) => outcome switch
    {
        BattleOutcome.Win => "win",
        BattleOutcome.Lose => "lose",
        BattleOutcome.Timeout => "timeout",
        _ => outcome.ToString().ToLowerInvariant(),
    };
}

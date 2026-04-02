using StoryDsl.Runtime;

namespace StoryDsl.Runtime.Tests;

internal sealed class TestRuntimeHost : IRuntimeHost
{
    public Dictionary<string, ExprValue> Variables { get; } = new(StringComparer.Ordinal);

    public Dictionary<string, Func<IReadOnlyList<ExprValue>, bool>> Predicates { get; } = new(StringComparer.Ordinal);

    public List<string> Commands { get; } = [];

    public Queue<int> ChoiceSelections { get; } = new();

    public Queue<BattleOutcome> BattleOutcomes { get; } = new();

    public int PredicateCalls { get; private set; }

    public ValueTask<ExprValue> GetVariableAsync(string name, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!Variables.TryGetValue(name, out var value))
        {
            throw new StoryRuntimeException($"Variable '{name}' was not configured in the test host.");
        }

        return ValueTask.FromResult(value);
    }

    public ValueTask<bool> EvaluatePredicateAsync(string name, IReadOnlyList<ExprValue> args, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        PredicateCalls += 1;
        if (!Predicates.TryGetValue(name, out var handler))
        {
            throw new StoryRuntimeException($"Predicate '{name}' was not configured in the test host.");
        }

        return ValueTask.FromResult(handler(args));
    }

    public ValueTask ExecuteCommandAsync(string name, IReadOnlyList<ExprValue> args, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Commands.Add($"{name}:{string.Join(",", args.Select(arg => arg.ToString()))}");
        return ValueTask.CompletedTask;
    }

    public ValueTask<int> ChooseOptionAsync(ChoiceContext choice, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (ChoiceSelections.Count == 0)
        {
            throw new StoryRuntimeException("No configured choice selection in the test host.");
        }

        return ValueTask.FromResult(ChoiceSelections.Dequeue());
    }

    public ValueTask<BattleOutcome> ResolveBattleAsync(BattleContext battle, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (BattleOutcomes.Count == 0)
        {
            throw new StoryRuntimeException("No configured battle outcome in the test host.");
        }

        return ValueTask.FromResult(BattleOutcomes.Dequeue());
    }
}

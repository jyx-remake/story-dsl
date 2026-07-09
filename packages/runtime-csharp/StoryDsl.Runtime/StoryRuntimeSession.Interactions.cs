using System.Runtime.CompilerServices;

namespace StoryDsl.Runtime;

internal sealed partial class StoryRuntimeSession
{
    private async IAsyncEnumerable<StepResult> ExecuteChoiceAsync(
        ChoiceStep choice,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var context = new ChoiceContext(
            choice.Prompt.Speaker,
            choice.Prompt.Text,
            choice.Options.Select((option, index) => new ChoiceOptionView(index, option.Text)).ToArray());

        yield return StepResult.FromEvent(new ChoiceOfferedEvent(context));

        var selectedIndex = await host.ChooseOptionAsync(context, ct);
        if (selectedIndex < 0 || selectedIndex >= choice.Options.Count)
        {
            throw new StoryRuntimeException(
                $"Choice selection index {selectedIndex} is out of range for {choice.Options.Count} options.");
        }

        yield return StepResult.FromEvent(new ChoiceResolvedEvent(context, selectedIndex));

        await foreach (var result in ExecuteStepsAsync(choice.Options[selectedIndex].Steps, ct))
        {
            yield return result;
            if (result.IsControl)
            {
                yield break;
            }
        }
    }

    private async IAsyncEnumerable<StepResult> ExecuteBattleAsync(
        BattleStep battle,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var context = new BattleContext(battle.BattleId, battle.Outcomes.Keys.ToArray());
        yield return StepResult.FromEvent(new BattleStartedEvent(context));

        var selectedOutcome = await host.ResolveBattleAsync(context, ct);
        if (!battle.Outcomes.TryGetValue(selectedOutcome, out var steps))
        {
            throw new StoryRuntimeException(
                $"Battle '{battle.BattleId}' resolved to '{selectedOutcome}', but the script does not define that outcome.");
        }

        yield return StepResult.FromEvent(new BattleResolvedEvent(context, selectedOutcome));

        await foreach (var result in ExecuteStepsAsync(steps, ct))
        {
            yield return result;
            if (result.IsControl)
            {
                yield break;
            }
        }
    }

    private async IAsyncEnumerable<StepResult> ExecuteBranchAsync(
        BranchStep branch,
        [EnumeratorCancellation] CancellationToken ct)
    {
        foreach (var branchCase in branch.Cases)
        {
            var result = await ExpressionEvaluator.EvaluateAsync(branchCase.When, host, ct);
            if (!result.AsBoolean("branch condition"))
            {
                continue;
            }

            await foreach (var stepResult in ExecuteStepsAsync(branchCase.Steps, ct))
            {
                yield return stepResult;
                if (stepResult.IsControl)
                {
                    yield break;
                }
            }

            yield break;
        }

        if (branch.Fallback is null)
        {
            yield break;
        }

        await foreach (var stepResult in ExecuteStepsAsync(branch.Fallback, ct))
        {
            yield return stepResult;
            if (stepResult.IsControl)
            {
                yield break;
            }
        }
    }
}

namespace StoryDsl.Runtime;

public abstract record RuntimeEvent;

public sealed record DialogueEvent(
    string Speaker,
    string Text) : RuntimeEvent;

public sealed record CommandExecutedEvent(
    string Name,
    IReadOnlyList<ExprValue> Args) : RuntimeEvent;

public sealed record ChoiceOfferedEvent(
    ChoiceContext Choice) : RuntimeEvent;

public sealed record ChoiceResolvedEvent(
    ChoiceContext Choice,
    int SelectedIndex) : RuntimeEvent;

public sealed record BattleStartedEvent(
    BattleContext Battle) : RuntimeEvent;

public sealed record BattleResolvedEvent(
    BattleContext Battle,
    BattleOutcome Outcome) : RuntimeEvent;

public sealed record JumpEvent(
    string Target) : RuntimeEvent;

public sealed record ChoiceContext(
    string PromptSpeaker,
    string PromptText,
    IReadOnlyList<ChoiceOptionView> Options);

public sealed record ChoiceOptionView(
    int Index,
    string Text);

public sealed record BattleContext(
    string BattleId,
    IReadOnlyList<BattleOutcome> AvailableOutcomes);

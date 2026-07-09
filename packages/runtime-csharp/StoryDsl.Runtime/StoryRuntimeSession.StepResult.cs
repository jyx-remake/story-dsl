namespace StoryDsl.Runtime;

internal sealed partial class StoryRuntimeSession
{
    private enum StepControl
    {
        Continue,
        Jump,
        Return,
    }

    private sealed record StepResult(RuntimeEvent? Event, StepControl Control, string? Target)
    {
        public bool IsControl => Control != StepControl.Continue;

        public static StepResult FromEvent(RuntimeEvent runtimeEvent) => new(runtimeEvent, StepControl.Continue, null);

        public static StepResult Jump(string jumpTarget) => new(null, StepControl.Jump, jumpTarget);

        public static StepResult Return() => new(null, StepControl.Return, null);
    }
}

namespace StoryDsl.Runtime;

public sealed class StoryRuntime
{
    public IAsyncEnumerable<RuntimeEvent> RunAsync(
        StoryScript script,
        IRuntimeHost host,
        string? startSegment = null,
        CancellationToken cancellationToken = default)
    {
        var session = new StoryRuntimeSession(script, host, startSegment, cancellationToken);
        return session.RunAsync();
    }
}

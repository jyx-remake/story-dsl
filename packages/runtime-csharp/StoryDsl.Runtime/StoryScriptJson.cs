using System.Text.Json;

namespace StoryDsl.Runtime;

public static class StoryScriptJson
{
    public static async Task<StoryScript> LoadFromFileAsync(string path, CancellationToken cancellationToken = default)
    {
        await using var stream = File.OpenRead(path);
        return await LoadAsync(stream, cancellationToken);
    }

    public static async Task<StoryScript> LoadAsync(Stream stream, CancellationToken cancellationToken = default)
    {
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return new StoryScriptJsonParser(document.RootElement).Parse();
    }

    public static StoryScript Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return new StoryScriptJsonParser(document.RootElement).Parse();
    }
}

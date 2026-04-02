# StoryDsl Runtime (C#)

This directory contains a `net8.0` C# runtime that consumes the JSON IR produced by the VSCode plugin.

Projects:

- `StoryDsl.Runtime`: runtime library
- `StoryDsl.Runtime.Cli`: interactive console demo
- `StoryDsl.Runtime.Tests`: xUnit test suite

Common commands:

```powershell
dotnet build .\StoryDsl.Runtime.slnx
dotnet test .\StoryDsl.Runtime.slnx
dotnet run --project .\StoryDsl.Runtime.Cli -- ..\..\examples\demo.story.json
```

# StoryDsl Runtime (C#)

Deprecated: this C# runtime is kept only as historical reference. It is not a current synchronization target for new DSL or JSON IR features.

This directory contains a `net10.0` C# runtime prototype that consumes the JSON IR produced by the VSCode plugin.

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

using System.Text.Json;
using CodexKeypad.Core;

var fixturePath = Path.Combine(Path.GetTempPath(), $"codex-keypad-contract-{Guid.NewGuid():N}.json");
var actionPath = Path.Combine(Path.GetTempPath(), $"codex-keypad-action-{Guid.NewGuid():N}.json");

try
{
    Run("accepts a normalized multi-project overview with a custom icon", () =>
    {
        File.WriteAllText(fixturePath, ProjectOverview());
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles[0].Action is CloseControlSurfaceAction
            && state.View.Tiles[1] is
            {
                IconPath: "/icons/architecture.png",
                Action: OpenTaskViewAction { ProjectId: "architecture" },
            }
            && state.View.Tiles[2].Action is OpenTaskViewAction { ProjectId: "codex-keypad" });
    });

    Run("accepts the normalized exact-task view", () =>
    {
        File.WriteAllText(fixturePath, TaskView("open-codex-task", "thread-123"));
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles[1].Action is OpenCodexTaskAction { ThreadId: "thread-123" });
    });

    Run("publishes one typed semantic action request", () =>
    {
        ControlSurfaceActionPublisher.Publish(actionPath, new OpenTaskViewAction("codex-keypad"));
        using var document = JsonDocument.Parse(File.ReadAllText(actionPath));
        var root = document.RootElement;
        Expect(root.GetProperty("schemaVersion").GetInt32() == 1
            && root.GetProperty("requestId").GetString()!.Length == 32
            && root.GetProperty("action").GetProperty("type").GetString() == "open-task-view"
            && root.GetProperty("action").GetProperty("projectId").GetString() == "codex-keypad");
    });

    Run("rejects an arbitrary executable action", () =>
    {
        File.WriteAllText(fixturePath, TaskView("run-command", "thread-123"));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("rejects an unsafe thread route", () =>
    {
        File.WriteAllText(fixturePath, TaskView("open-codex-task", "../settings"));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("rejects an unsafe icon path", () =>
    {
        File.WriteAllText(fixturePath, ProjectOverview().Replace(
            "/icons/architecture.png",
            "icons/architecture.png",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("accepts enough ordered task tiles for native device pagination", () =>
    {
        File.WriteAllText(fixturePath, ManyTaskView(10));
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles.Count == 11
            && state.View.Tiles[^1].Action is OpenCodexTaskAction { ThreadId: "thread-10" });
    });

    Console.WriteLine("Adapter contract tests passed.");
}
finally
{
    File.Delete(fixturePath);
    File.Delete(actionPath);
}

static void Run(String name, Action test)
{
    try
    {
        test();
    }
    catch (Exception error)
    {
        throw new InvalidOperationException($"Contract test failed: {name}", error);
    }
}

static void Expect(Boolean condition)
{
    if (!condition)
    {
        throw new InvalidOperationException("expectation was false");
    }
}

static String ProjectOverview() => """
{
  "schemaVersion": 4,
  "revision": "project-overview:projects:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 3 active",
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "project-overview",
    "title": "Projects",
    "tiles": [
      { "id": "nav.back", "label": "Back", "action": { "type": "close-control-surface" } },
      {
        "id": "project:architecture",
        "label": "Architecture · 2 active",
        "iconPath": "/icons/architecture.png",
        "action": { "type": "open-task-view", "projectId": "architecture" }
      },
      {
        "id": "project:codex-keypad",
        "label": "Codex Keypad · 1 active",
        "action": { "type": "open-task-view", "projectId": "codex-keypad" }
      }
    ]
  }
}
""";

static String TaskView(String taskActionType, String threadId) => $$"""
{
  "schemaVersion": 4,
  "revision": "task-view:thread-123:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 1 active",
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "task-view",
    "title": "Codex Keypad",
    "tiles": [
      { "id": "nav.back", "label": "Back", "action": { "type": "open-project-overview" } },
      {
        "id": "task:{{threadId}}",
        "label": "Exact task · Working",
        "status": "working",
        "action": { "type": "{{taskActionType}}", "threadId": "{{threadId}}" }
      }
    ]
  }
}
""";

static String ManyTaskView(Int32 taskCount)
{
    var tiles = new Object[]
    {
        new
        {
            id = "nav.back",
            label = "Back",
            action = new { type = "open-project-overview" },
        },
    }.Concat(Enumerable.Range(1, taskCount).Select(index => (Object)new
    {
        id = $"task:thread-{index}",
        label = $"Task {index} · Working",
        status = "working",
        action = new { type = "open-codex-task", threadId = $"thread-{index}" },
    }));
    return JsonSerializer.Serialize(new
    {
        schemaVersion = 4,
        revision = "many-tasks:456",
        entry = new
        {
            id = "codex",
            label = "Codex · 10 active",
            action = new { type = "open-project-overview" },
        },
        view = new { level = "task-view", title = "Codex Keypad", tiles },
    });
}

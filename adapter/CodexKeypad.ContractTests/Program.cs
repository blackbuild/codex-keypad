using System.Text.Json;
using CodexKeypad.Core;

var fixturePath = Path.Combine(Path.GetTempPath(), $"codex-keypad-contract-{Guid.NewGuid():N}.json");
var actionPath = Path.Combine(Path.GetTempPath(), $"codex-keypad-action-{Guid.NewGuid():N}.json");

try
{
    Run("accepts normalized attention and visual presentation without deriving policy", () =>
    {
        File.WriteAllText(fixturePath, AttentionProjectOverview());
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.Entry.Attention.Primary == "failed"
            && state.Entry.Visual is
            {
                Icon: "entry",
                Glyph: "C",
                Tone: "failed",
                BackgroundColor: "#7F1D1D",
                ForegroundColor: "#FFFFFF",
                Badge: "!A~+1",
            }
            && state.Entry.Visual.BorderColors.SequenceEqual([
                "#F87171",
                "#FACC15",
                "#FDBA74",
            ]));
    });

    Run("rejects legacy or unbounded visual contracts", () =>
    {
        File.WriteAllText(fixturePath, ProjectOverview().Replace(
            "\"schemaVersion\": 8",
            "\"schemaVersion\": 7",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));

        File.WriteAllText(fixturePath, AttentionProjectOverview().Replace(
            "{ \"state\": \"stale\", \"count\": 1 }",
            "{ \"state\": \"stale\", \"count\": 1 }, { \"state\": \"working\", \"count\": 1 }",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("rejects malformed colors and mismatched fallback icons", () =>
    {
        File.WriteAllText(fixturePath, AttentionProjectOverview().Replace(
            "#7F1D1D",
            "red",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));

        File.WriteAllText(fixturePath, AttentionProjectOverview().Replace(
            "\"icon\": \"entry\"",
            "\"icon\": \"task\"",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("accepts a normalized multi-project overview with a custom icon", () =>
    {
        File.WriteAllText(fixturePath, ProjectOverview());
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles[0] is
            {
                IconPath: "/icons/architecture.png",
                Action: OpenTaskViewAction { ProjectId: "architecture" },
            }
            && state.View.Tiles[1].Action is OpenTaskViewAction { ProjectId: "codex-keypad" });
    });

    Run("accepts the normalized exact-task view", () =>
    {
        File.WriteAllText(fixturePath, TaskView("open-codex-task", "thread-123"));
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles[1].Action is OpenCodexTaskAction { ThreadId: "thread-123" });
    });

    Run("accepts only the normalized unavailable fallback for an unknown task state", () =>
    {
        File.WriteAllText(fixturePath, TaskView("open-codex-task", "thread-123").Replace(
            "\"working\"",
            "\"unavailable\"",
            StringComparison.Ordinal));
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted && state!.View.Tiles[1].Status == "unavailable");

        File.WriteAllText(fixturePath, TaskView("open-codex-task", "thread-123").Replace(
            "\"status\": \"working\"",
            "\"status\": \"futureCodexState\"",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
    });

    Run("accepts a project-icon coordinator before the task-view Back tile", () =>
    {
        File.WriteAllText(fixturePath, CoordinatorTaskView());
        var accepted = ControlSurfaceContract.TryRead(fixturePath, out var state);
        Expect(accepted
            && state!.View.Tiles[0] is
            {
                Role: "coordinator",
                IconPath: "/icons/codex-keypad.png",
                Action: OpenCodexTaskAction { ThreadId: "hive-thread" },
            }
            && state.View.Tiles[1].Id == "nav.back"
            && state.View.Tiles[1].Action is OpenProjectOverviewAction);
    });

    Run("rejects a redundant Back tile in the project overview", () =>
    {
        File.WriteAllText(fixturePath, ProjectOverview().Replace(
            "\"tiles\": [",
            "\"tiles\": [\n      { \"id\": \"nav.back\", \"label\": \"Back\", \"action\": { \"type\": \"close-control-surface\" } },",
            StringComparison.Ordinal));
        Expect(!ControlSurfaceContract.TryRead(fixturePath, out _));
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
  "schemaVersion": 8,
  "revision": "project-overview:projects:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 3 active",
    "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 3 }], "additionalStates": 0 },
    "visual": { "icon": "entry", "glyph": "C", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "project-overview",
    "title": "Projects",
    "tiles": [
      {
        "id": "project:architecture",
        "label": "Architecture · 2 active",
        "iconPath": "/icons/architecture.png",
        "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 2 }], "additionalStates": 0 },
        "visual": { "icon": "project", "glyph": "P", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
        "action": { "type": "open-task-view", "projectId": "architecture" }
      },
      {
        "id": "project:codex-keypad",
        "label": "Codex Keypad · 1 active",
        "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
        "visual": { "icon": "project", "glyph": "P", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
        "action": { "type": "open-task-view", "projectId": "codex-keypad" }
      }
    ]
  }
}
""";

static String AttentionProjectOverview() => """
{
  "schemaVersion": 8,
  "revision": "attention-project-overview:456",
  "entry": {
    "id": "codex",
    "label": "Codex · Failed +3 states · count stale",
    "attention": {
      "primary": "failed",
      "indicators": [
        { "state": "failed", "count": 1 },
        { "state": "waiting-for-approval", "count": 1 },
        { "state": "stale", "count": 1 }
      ],
      "additionalStates": 1
    },
    "visual": {
      "icon": "entry",
      "glyph": "C",
      "tone": "failed",
      "backgroundColor": "#7F1D1D",
      "foregroundColor": "#FFFFFF",
      "borderColors": ["#F87171", "#FACC15", "#FDBA74"],
      "badge": "!A~+1"
    },
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "project-overview",
    "title": "Projects",
    "tiles": []
  }
}
""";

static String TaskView(String taskActionType, String threadId) => $$"""
{
  "schemaVersion": 8,
  "revision": "task-view:thread-123:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 1 active",
    "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
    "visual": { "icon": "entry", "glyph": "C", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "task-view",
    "title": "Codex Keypad",
    "tiles": [
      { "id": "nav.back", "label": "Back", "visual": { "icon": "back", "glyph": "<", "tone": "navigation", "backgroundColor": "#111827", "foregroundColor": "#FFFFFF", "borderColors": [], "badge": "" }, "action": { "type": "open-project-overview" } },
      {
        "id": "task:{{threadId}}",
        "label": "Exact task · Working",
        "status": "working",
        "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
        "visual": { "icon": "task", "glyph": "T", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
        "action": { "type": "{{taskActionType}}", "threadId": "{{threadId}}" }
      }
    ]
  }
}
""";

static String CoordinatorTaskView() => """
{
  "schemaVersion": 8,
  "revision": "task-view:hive-thread:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 1 active",
    "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
    "visual": { "icon": "entry", "glyph": "C", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
    "action": { "type": "open-project-overview" }
  },
  "view": {
    "level": "task-view",
    "title": "Codex Keypad",
    "tiles": [
      {
        "id": "task:hive-thread",
        "label": "Codex Keypad Hive · Working",
        "iconPath": "/icons/codex-keypad.png",
        "role": "coordinator",
        "status": "working",
        "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
        "visual": { "icon": "task", "glyph": "T", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
        "action": { "type": "open-codex-task", "threadId": "hive-thread" }
      },
      { "id": "nav.back", "label": "Back", "visual": { "icon": "back", "glyph": "<", "tone": "navigation", "backgroundColor": "#111827", "foregroundColor": "#FFFFFF", "borderColors": [], "badge": "" }, "action": { "type": "open-project-overview" } },
      {
        "id": "task:worker-thread",
        "label": "Worker · Working",
        "status": "working",
        "attention": { "primary": "working", "indicators": [{ "state": "working", "count": 1 }], "additionalStates": 0 },
        "visual": { "icon": "task", "glyph": "T", "tone": "working", "backgroundColor": "#075985", "foregroundColor": "#FFFFFF", "borderColors": ["#38BDF8"], "badge": ">" },
        "action": { "type": "open-codex-task", "threadId": "worker-thread" }
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
            visual = BackVisual(),
            action = new { type = "open-project-overview" },
        },
    }.Concat(Enumerable.Range(1, taskCount).Select(index => (Object)new
    {
        id = $"task:thread-{index}",
        label = $"Task {index} · Working",
        status = "working",
        attention = WorkingAttention(),
        visual = WorkingVisual("task", "T"),
        action = new { type = "open-codex-task", threadId = $"thread-{index}" },
    }));
    return JsonSerializer.Serialize(new
    {
        schemaVersion = 8,
        revision = "many-tasks:456",
        entry = new
        {
            id = "codex",
            label = "Codex · 10 active",
            attention = WorkingAttention(10),
            visual = WorkingVisual("entry", "C"),
            action = new { type = "open-project-overview" },
        },
        view = new { level = "task-view", title = "Codex Keypad", tiles },
    });
}

static Object WorkingAttention(Int32 count = 1) => new
{
    primary = "working",
    indicators = new[] { new { state = "working", count } },
    additionalStates = 0,
};

static Object WorkingVisual(String icon, String glyph) => new
{
    icon,
    glyph,
    tone = "working",
    backgroundColor = "#075985",
    foregroundColor = "#FFFFFF",
    borderColors = new[] { "#38BDF8" },
    badge = ">",
};

static Object BackVisual() => new
{
    icon = "back",
    glyph = "<",
    tone = "navigation",
    backgroundColor = "#111827",
    foregroundColor = "#FFFFFF",
    borderColors = Array.Empty<String>(),
    badge = "",
};

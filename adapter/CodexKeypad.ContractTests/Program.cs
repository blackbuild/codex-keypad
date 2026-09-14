using CodexKeypad.Core;

var fixturePath = Path.Combine(Path.GetTempPath(), $"codex-keypad-contract-{Guid.NewGuid():N}.json");

try
{
    File.WriteAllText(fixturePath, ValidState("open-codex-task", "thread-123"));
    Expect(ControlSurfaceContract.TryRead(fixturePath, out var state), "valid normalized state is accepted");

    var navigator = new ControlSurfaceNavigator(state);
    Expect(navigator.EntryLabel == "Codex · 1 active", "entry label comes from normalized state");
    Expect(navigator.GetTiles().Select(tile => tile.Label).SequenceEqual(["Back", "Codex Keypad · 1 active"]),
        "Level 1 contains Back and one project tile");
    Expect(navigator.Handle("project:codex-keypad").Kind == NavigationOutcomeKind.Refresh,
        "the project semantic action opens Level 2");
    Expect(navigator.GetTiles().Select(tile => tile.Label).SequenceEqual(["Back", "Exact task"]),
        "Level 2 contains Back and one task tile");

    var open = navigator.Handle("task:thread-123");
    Expect(open == new NavigationOutcome(NavigationOutcomeKind.OpenCodexTask, "thread-123"),
        "the task tile resolves the exact normalized thread ID");
    Expect(CodexThreadDeepLink.TryCreate(open.ThreadId!, out var uri)
        && uri!.AbsoluteUri == "codex://threads/thread-123",
        "the exact thread ID becomes the validated Codex deep link");
    Expect(navigator.Handle("nav.back").Kind == NavigationOutcomeKind.Refresh,
        "Back returns from Level 2 to Level 1");
    Expect(navigator.Handle("nav.back").Kind == NavigationOutcomeKind.Close,
        "Back closes the root dynamic folder");

    File.WriteAllText(fixturePath, ValidState("run-command", "rm-everything"));
    Expect(!ControlSurfaceContract.TryRead(fixturePath, out _),
        "an arbitrary action type is rejected at the handoff boundary");

    File.WriteAllText(fixturePath, ValidState("open-codex-task", "../settings"));
    Expect(!ControlSurfaceContract.TryRead(fixturePath, out _),
        "an unsafe thread route is rejected at the handoff boundary");

    Console.WriteLine("Adapter contract tests passed.");
}
finally
{
    File.Delete(fixturePath);
}

static void Expect(Boolean condition, String message)
{
    if (!condition)
    {
        throw new InvalidOperationException($"Contract test failed: {message}");
    }
}

static String ValidState(String taskActionType, String threadId) => $$"""
{
  "schemaVersion": 1,
  "revision": "thread-123:456",
  "entry": {
    "id": "codex",
    "label": "Codex · 1 active",
    "action": { "type": "open-project-overview" }
  },
  "projects": [
    {
      "id": "codex-keypad",
      "label": "Codex Keypad",
      "summary": "1 active",
      "action": { "type": "open-task-view", "projectId": "codex-keypad" },
      "tasks": [
        {
          "id": "{{threadId}}",
          "label": "Exact task",
          "status": "working",
          "action": { "type": "{{taskActionType}}", "threadId": "{{threadId}}" }
        }
      ]
    }
  ]
}
""";

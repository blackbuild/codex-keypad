namespace CodexKeypad.Core;

public enum NavigationOutcomeKind
{
    Ignored,
    Refresh,
    Close,
    OpenCodexTask,
}

public sealed record NavigationOutcome(NavigationOutcomeKind Kind, String? ThreadId = null);

public sealed record ControlSurfaceTile(String ActionParameter, String Label);

public sealed class ControlSurfaceNavigator
{
    public const String BackActionParameter = "nav.back";

    private ControlSurfaceState? _state;
    private Boolean _showingTasks;

    public ControlSurfaceNavigator(ControlSurfaceState? state = null)
    {
        this._state = state;
    }

    public String EntryLabel => this._state?.Entry.Label ?? "Codex · unavailable";

    public String? Revision => this._state?.Revision;

    public void Update(ControlSurfaceState state)
    {
        this._state = state;
        this._showingTasks = this._showingTasks && state.Projects.Count == 1;
    }

    public IReadOnlyList<ControlSurfaceTile> GetTiles()
    {
        var tiles = new List<ControlSurfaceTile>
        {
            new(BackActionParameter, "Back"),
        };
        var project = this._state?.Projects.SingleOrDefault();
        if (project is null)
        {
            return tiles;
        }

        if (!this._showingTasks)
        {
            tiles.Add(new($"project:{project.Id}", $"{project.Label} · {project.Summary}"));
            return tiles;
        }

        var task = project.Tasks.SingleOrDefault();
        if (task is not null)
        {
            tiles.Add(new($"task:{task.Id}", task.Label));
        }
        return tiles;
    }

    public NavigationOutcome Handle(String actionParameter)
    {
        if (actionParameter == BackActionParameter)
        {
            if (!this._showingTasks)
            {
                return new(NavigationOutcomeKind.Close);
            }

            this._showingTasks = false;
            return new(NavigationOutcomeKind.Refresh);
        }

        var project = this._state?.Projects.SingleOrDefault();
        if (project is null)
        {
            return new(NavigationOutcomeKind.Ignored);
        }

        if (!this._showingTasks
            && actionParameter == $"project:{project.Id}"
            && project.Action.Type == "open-task-view"
            && project.Action.ProjectId == project.Id)
        {
            this._showingTasks = true;
            return new(NavigationOutcomeKind.Refresh);
        }

        var task = project.Tasks.SingleOrDefault();
        if (this._showingTasks
            && task is not null
            && actionParameter == $"task:{task.Id}"
            && task.Action.Type == "open-codex-task"
            && task.Action.ThreadId == task.Id
            && ControlSurfaceContract.IsSafeThreadId(task.Id))
        {
            return new(NavigationOutcomeKind.OpenCodexTask, task.Id);
        }

        return new(NavigationOutcomeKind.Ignored);
    }
}

namespace CodexKeypad.Core;

using System.Text.RegularExpressions;
using Newtonsoft.Json;

public sealed class ControlSurfaceState
{
    [JsonProperty("schemaVersion", Required = Required.Always)]
    public Int32 SchemaVersion { get; init; }

    [JsonProperty("revision", Required = Required.Always)]
    public String Revision { get; init; } = String.Empty;

    [JsonProperty("entry", Required = Required.Always)]
    public ControlSurfaceEntry Entry { get; init; } = new();

    [JsonProperty("projects", Required = Required.Always)]
    public IReadOnlyList<ControlSurfaceProject> Projects { get; init; } = [];
}

public sealed class ControlSurfaceEntry
{
    [JsonProperty("id", Required = Required.Always)]
    public String Id { get; init; } = String.Empty;

    [JsonProperty("label", Required = Required.Always)]
    public String Label { get; init; } = String.Empty;

    [JsonProperty("action", Required = Required.Always)]
    public SemanticAction Action { get; init; } = new();
}

public sealed class ControlSurfaceProject
{
    [JsonProperty("id", Required = Required.Always)]
    public String Id { get; init; } = String.Empty;

    [JsonProperty("label", Required = Required.Always)]
    public String Label { get; init; } = String.Empty;

    [JsonProperty("summary", Required = Required.Always)]
    public String Summary { get; init; } = String.Empty;

    [JsonProperty("action", Required = Required.Always)]
    public SemanticAction Action { get; init; } = new();

    [JsonProperty("tasks", Required = Required.Always)]
    public IReadOnlyList<ControlSurfaceTask> Tasks { get; init; } = [];
}

public sealed class ControlSurfaceTask
{
    [JsonProperty("id", Required = Required.Always)]
    public String Id { get; init; } = String.Empty;

    [JsonProperty("label", Required = Required.Always)]
    public String Label { get; init; } = String.Empty;

    [JsonProperty("status", Required = Required.Always)]
    public String Status { get; init; } = String.Empty;

    [JsonProperty("action", Required = Required.Always)]
    public SemanticAction Action { get; init; } = new();
}

public sealed class SemanticAction
{
    [JsonProperty("type", Required = Required.Always)]
    public String Type { get; init; } = String.Empty;

    [JsonProperty("projectId")]
    public String? ProjectId { get; init; }

    [JsonProperty("threadId")]
    public String? ThreadId { get; init; }
}

public static partial class ControlSurfaceContract
{
    private const Int32 MaximumLabelLength = 80;
    private static readonly HashSet<String> TaskStatuses =
    [
        "working",
        "waiting-for-approval",
        "waiting-for-input",
        "completed",
        "failed",
        "interrupted",
    ];

    public static Boolean TryRead(String path, out ControlSurfaceState? state)
    {
        state = null;
        try
        {
            var json = File.ReadAllText(path);
            var parsed = JsonConvert.DeserializeObject<ControlSurfaceState>(
                json,
                new JsonSerializerSettings
                {
                    MissingMemberHandling = MissingMemberHandling.Error,
                });
            if (parsed is null || !IsValid(parsed))
            {
                return false;
            }

            state = parsed;
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public static Boolean IsSafeThreadId(String threadId) => SafeIdentifier().IsMatch(threadId);

    private static Boolean IsValid(ControlSurfaceState state)
    {
        if (state.SchemaVersion != 1
            || String.IsNullOrWhiteSpace(state.Revision)
            || state.Entry.Id != "codex"
            || !IsLabel(state.Entry.Label)
            || state.Entry.Action.Type != "open-project-overview"
            || state.Entry.Action.ProjectId is not null
            || state.Entry.Action.ThreadId is not null
            || state.Projects.Count != 1)
        {
            return false;
        }

        var project = state.Projects[0];
        if (!SafeIdentifier().IsMatch(project.Id)
            || !IsLabel(project.Label)
            || !IsLabel(project.Summary)
            || project.Action.Type != "open-task-view"
            || project.Action.ProjectId != project.Id
            || project.Action.ThreadId is not null
            || project.Tasks.Count > 1)
        {
            return false;
        }

        if (project.Tasks.Count == 0)
        {
            return true;
        }

        var task = project.Tasks[0];
        return IsSafeThreadId(task.Id)
            && IsLabel(task.Label)
            && TaskStatuses.Contains(task.Status)
            && task.Action.Type == "open-codex-task"
            && task.Action.ProjectId is null
            && task.Action.ThreadId == task.Id;
    }

    private static Boolean IsLabel(String value) =>
        !String.IsNullOrWhiteSpace(value) && value.Length <= MaximumLabelLength;

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeIdentifier();
}

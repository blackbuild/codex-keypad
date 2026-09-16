namespace CodexKeypad.Core;

using System.Text.RegularExpressions;
using Newtonsoft.Json;

public sealed record ControlSurfaceState(
    Int32 SchemaVersion,
    String Revision,
    ControlSurfaceEntry Entry,
    ControlSurfaceView View);

public sealed record ControlSurfaceEntry(
    String Id,
    String Label,
    OpenProjectOverviewAction Action);

public sealed record ControlSurfaceView(
    String Level,
    String Title,
    IReadOnlyList<ControlSurfaceTile> Tiles);

public sealed record ControlSurfaceTile(
    String Id,
    String Label,
    String? IconPath,
    String? Status,
    SemanticAction Action);

public abstract record SemanticAction(
    [property: JsonProperty("type")] String Type);

public sealed record OpenProjectOverviewAction() :
    SemanticAction("open-project-overview");

public sealed record OpenProjectPageAction(
    [property: JsonProperty("page")] Int32 Page) :
    SemanticAction("open-project-page");

public sealed record CloseControlSurfaceAction() :
    SemanticAction("close-control-surface");

public sealed record OpenTaskViewAction(
    [property: JsonProperty("projectId")] String ProjectId) :
    SemanticAction("open-task-view");

public sealed record OpenCodexTaskAction(
    [property: JsonProperty("threadId")] String ThreadId) :
    SemanticAction("open-codex-task");

public static partial class ControlSurfaceContract
{
    private const Int32 MaximumContractBytes = 64 * 1024;
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
            if (new FileInfo(path).Length > MaximumContractBytes)
            {
                return false;
            }
            var wire = JsonConvert.DeserializeObject<WireState>(
                File.ReadAllText(path),
                new JsonSerializerSettings { MissingMemberHandling = MissingMemberHandling.Error });
            return wire is not null && TryNormalize(wire, out state);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static Boolean TryNormalize(WireState wire, out ControlSurfaceState? state)
    {
        state = null;
        if (wire.SchemaVersion != 2
            || String.IsNullOrWhiteSpace(wire.Revision)
            || wire.Revision.Length > 256
            || wire.Entry.Id != "codex"
            || !IsLabel(wire.Entry.Label)
            || !IsAction(wire.Entry.Action, "open-project-overview")
            || !IsLabel(wire.View.Title)
            || wire.View.Tiles.Count is < 1 or > 9)
        {
            return false;
        }

        var tiles = new List<ControlSurfaceTile>();
        foreach (var tile in wire.View.Tiles)
        {
            if (!TryNormalizeTile(tile, out var normalized) || normalized is null)
            {
                return false;
            }
            tiles.Add(normalized);
        }

        if (!IsValidView(wire.View.Level, tiles))
        {
            return false;
        }

        state = new ControlSurfaceState(
            wire.SchemaVersion,
            wire.Revision,
            new ControlSurfaceEntry(wire.Entry.Id, wire.Entry.Label, new OpenProjectOverviewAction()),
            new ControlSurfaceView(wire.View.Level, wire.View.Title, tiles));
        return true;
    }

    private static Boolean TryNormalizeTile(WireTile wire, out ControlSurfaceTile? tile)
    {
        tile = null;
        if (!IsSafeTileId(wire.Id)
            || !IsLabel(wire.Label)
            || wire.IconPath is not null && !IsIconPath(wire.IconPath))
        {
            return false;
        }

        SemanticAction? action = wire.Action.Type switch
        {
            "open-project-overview" when IsAction(wire.Action, "open-project-overview") =>
                new OpenProjectOverviewAction(),
            "open-project-page" when wire.Action.ProjectId is null
                && wire.Action.ThreadId is null
                && wire.Action.Page is >= 0 and <= 63 =>
                new OpenProjectPageAction(wire.Action.Page.Value),
            "close-control-surface" when IsAction(wire.Action, "close-control-surface") =>
                new CloseControlSurfaceAction(),
            "open-task-view" when wire.Action.ThreadId is null
                && wire.Action.Page is null
                && IsSafeIdentifier(wire.Action.ProjectId) =>
                new OpenTaskViewAction(wire.Action.ProjectId!),
            "open-codex-task" when wire.Action.ProjectId is null
                && wire.Action.Page is null
                && IsSafeIdentifier(wire.Action.ThreadId) =>
                new OpenCodexTaskAction(wire.Action.ThreadId!),
            _ => null,
        };
        if (action is null)
        {
            return false;
        }

        tile = new ControlSurfaceTile(wire.Id, wire.Label, wire.IconPath, wire.Status, action);
        return true;
    }

    private static Boolean IsValidView(String level, IReadOnlyList<ControlSurfaceTile> tiles)
    {
        if (tiles[0].Id != "nav.back")
        {
            return false;
        }
        if (tiles.Select(tile => tile.Id).Distinct(StringComparer.Ordinal).Count() != tiles.Count)
        {
            return false;
        }

        if (level == "project-overview")
        {
            if (tiles[0].Action is not CloseControlSurfaceAction
                || tiles[0].Status is not null
                || tiles[0].IconPath is not null)
            {
                return false;
            }

            return tiles.Skip(1).All(tile => tile switch
            {
                { Action: OpenTaskViewAction projectAction, Status: null }
                    when tile.Id == $"project:{projectAction.ProjectId}" => true,
                { Id: "page.previous" or "page.next", IconPath: null, Status: null,
                    Action: OpenProjectPageAction } => true,
                _ => false,
            });
        }

        if (level != "task-view"
            || tiles[0].Action is not OpenProjectOverviewAction
            || tiles[0].Status is not null
            || tiles[0].IconPath is not null)
        {
            return false;
        }

        return tiles.Count == 1
            || tiles.Count == 2
                && tiles[1].Action is OpenCodexTaskAction taskAction
                && tiles[1].Id == $"task:{taskAction.ThreadId}"
                && tiles[1].IconPath is null
                && tiles[1].Status is not null
                && TaskStatuses.Contains(tiles[1].Status!);
    }

    private static Boolean IsAction(WireAction action, String type) =>
        action.Type == type
            && action.Page is null
            && action.ProjectId is null
            && action.ThreadId is null;

    private static Boolean IsLabel(String value) =>
        !String.IsNullOrWhiteSpace(value) && value.Length <= MaximumLabelLength;

    private static Boolean IsSafeIdentifier(String? value) =>
        value is not null && SafeIdentifier().IsMatch(value);

    private static Boolean IsSafeTileId(String? value) =>
        value is not null && SafeTileId().IsMatch(value);

    private static Boolean IsIconPath(String value) =>
        value.Length <= 1024
            && Path.IsPathFullyQualified(value)
            && Path.GetExtension(value).Equals(".png", StringComparison.OrdinalIgnoreCase);

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeIdentifier();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeTileId();

    private sealed class WireState
    {
        [JsonProperty("schemaVersion", Required = Required.Always)]
        public Int32 SchemaVersion { get; init; }

        [JsonProperty("revision", Required = Required.Always)]
        public String Revision { get; init; } = String.Empty;

        [JsonProperty("entry", Required = Required.Always)]
        public WireEntry Entry { get; init; } = new();

        [JsonProperty("view", Required = Required.Always)]
        public WireView View { get; init; } = new();
    }

    private sealed class WireEntry
    {
        [JsonProperty("id", Required = Required.Always)]
        public String Id { get; init; } = String.Empty;

        [JsonProperty("label", Required = Required.Always)]
        public String Label { get; init; } = String.Empty;

        [JsonProperty("action", Required = Required.Always)]
        public WireAction Action { get; init; } = new();
    }

    private sealed class WireView
    {
        [JsonProperty("level", Required = Required.Always)]
        public String Level { get; init; } = String.Empty;

        [JsonProperty("title", Required = Required.Always)]
        public String Title { get; init; } = String.Empty;

        [JsonProperty("tiles", Required = Required.Always)]
        public IReadOnlyList<WireTile> Tiles { get; init; } = [];
    }

    private sealed class WireTile
    {
        [JsonProperty("id", Required = Required.Always)]
        public String Id { get; init; } = String.Empty;

        [JsonProperty("label", Required = Required.Always)]
        public String Label { get; init; } = String.Empty;

        [JsonProperty("iconPath")]
        public String? IconPath { get; init; }

        [JsonProperty("status")]
        public String? Status { get; init; }

        [JsonProperty("action", Required = Required.Always)]
        public WireAction Action { get; init; } = new();
    }

    private sealed class WireAction
    {
        [JsonProperty("type", Required = Required.Always)]
        public String Type { get; init; } = String.Empty;

        [JsonProperty("projectId")]
        public String? ProjectId { get; init; }

        [JsonProperty("threadId")]
        public String? ThreadId { get; init; }

        [JsonProperty("page")]
        public Int32? Page { get; init; }
    }
}

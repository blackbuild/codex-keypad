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
    String? Role,
    SemanticAction Action);

public abstract record SemanticAction(
    [property: JsonProperty("type")] String Type);

public sealed record OpenProjectOverviewAction() :
    SemanticAction("open-project-overview");

public sealed record OpenTaskViewAction(
    [property: JsonProperty("projectId")] String ProjectId) :
    SemanticAction("open-task-view");

public sealed record OpenCodexTaskAction(
    [property: JsonProperty("threadId")] String ThreadId) :
    SemanticAction("open-codex-task");

public static partial class ControlSurfaceContract
{
    private const Int32 MaximumContractBytes = 256 * 1024;
    private const Int32 MaximumTiles = 257;
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
        if (wire.SchemaVersion != 6
            || String.IsNullOrWhiteSpace(wire.Revision)
            || wire.Revision.Length > 256
            || wire.Entry.Id != "codex"
            || !IsLabel(wire.Entry.Label)
            || !IsAction(wire.Entry.Action, "open-project-overview")
            || !IsLabel(wire.View.Title)
            || wire.View.Tiles.Count > MaximumTiles)
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
            || wire.IconPath is not null && !IsIconPath(wire.IconPath)
            || wire.Role is not null and not "coordinator")
        {
            return false;
        }

        SemanticAction? action = wire.Action.Type switch
        {
            "open-project-overview" when IsAction(wire.Action, "open-project-overview") =>
                new OpenProjectOverviewAction(),
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

        tile = new ControlSurfaceTile(
            wire.Id,
            wire.Label,
            wire.IconPath,
            wire.Status,
            wire.Role,
            action);
        return true;
    }

    private static Boolean IsValidView(String level, IReadOnlyList<ControlSurfaceTile> tiles)
    {
        if (tiles.Select(tile => tile.Id).Distinct(StringComparer.Ordinal).Count() != tiles.Count)
        {
            return false;
        }

        if (level == "project-overview")
        {
            return tiles.All(tile => tile switch
            {
                { Action: OpenTaskViewAction projectAction, Status: null, Role: null }
                    when tile.Id == $"project:{projectAction.ProjectId}" => true,
                _ => false,
            });
        }

        if (level != "task-view" || tiles.Count == 0)
        {
            return false;
        }

        var backIndexes = tiles
            .Select((tile, index) => (tile, index))
            .Where(entry => entry.tile.Id == "nav.back")
            .Select(entry => entry.index)
            .ToArray();
        var coordinatorIndexes = tiles
            .Select((tile, index) => (tile, index))
            .Where(entry => entry.tile.Role == "coordinator")
            .Select(entry => entry.index)
            .ToArray();
        var expectedBackIndex = coordinatorIndexes.Length == 1 ? 1 : 0;
        if (backIndexes is not [var backIndex]
            || coordinatorIndexes.Length > 1
            || coordinatorIndexes.Length == 1 && coordinatorIndexes[0] != 0
            || backIndex != expectedBackIndex
            || tiles[backIndex].Action is not OpenProjectOverviewAction
            || tiles[backIndex].Status is not null
            || tiles[backIndex].IconPath is not null
            || tiles[backIndex].Role is not null)
        {
            return false;
        }

        return tiles.Where((_, index) => index != backIndex).All(tile => tile switch
        {
            { Action: OpenCodexTaskAction taskAction }
                when tile.Id == $"task:{taskAction.ThreadId}"
                    && tile.Status is not null
                    && TaskStatuses.Contains(tile.Status)
                    && (tile.Role == "coordinator" || tile.IconPath is null) => true,
            _ => false,
        });
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

        [JsonProperty("role")]
        public String? Role { get; init; }

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

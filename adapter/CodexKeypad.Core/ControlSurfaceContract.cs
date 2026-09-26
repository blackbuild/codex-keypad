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
    AttentionSummary Attention,
    VisualPresentation Visual,
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
    AttentionSummary? Attention,
    VisualPresentation Visual,
    SemanticAction Action);

public sealed record AttentionSummary(
    String Primary,
    IReadOnlyList<AttentionIndicator> Indicators,
    Int32 AdditionalStates);

public sealed record AttentionIndicator(String State, Int32 Count);

public sealed record WorkerIndicatorPresentation(
    String State,
    Int32 Count,
    String Color,
    String Side);

public sealed record VisualPresentation(
    String Icon,
    String Glyph,
    String Tone,
    String BackgroundColor,
    String ForegroundColor,
    IReadOnlyList<String> BorderColors,
    String Badge,
    IReadOnlyList<WorkerIndicatorPresentation> WorkerIndicators);

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
    private static readonly HashSet<String> AttentionStates =
    [
        "idle",
        "working",
        "waiting-for-input",
        "waiting-for-approval",
        "waiting-for-review",
        "interrupted",
        "failed",
        "unavailable",
        "stale",
    ];
    private static readonly HashSet<String> VisualIcons = ["entry", "project", "task", "back"];
    private static readonly HashSet<String> TaskStatuses =
    [
        "working",
        "waiting-for-approval",
        "waiting-for-input",
        "completed",
        "failed",
        "interrupted",
        "unavailable",
    ];
    private static readonly IReadOnlyDictionary<String, Int32> AttentionPrecedence =
        new Dictionary<String, Int32>(StringComparer.Ordinal)
        {
            ["failed"] = 0,
            ["waiting-for-approval"] = 1,
            ["waiting-for-review"] = 2,
            ["waiting-for-input"] = 3,
            ["interrupted"] = 4,
            ["unavailable"] = 5,
            ["stale"] = 6,
            ["working"] = 7,
            ["idle"] = 8,
        };

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
        if (wire.SchemaVersion != 10
            || String.IsNullOrWhiteSpace(wire.Revision)
            || wire.Revision.Length > 256
            || wire.Entry.Id != "codex"
            || wire.Entry.Label != "Codex"
            || !TryNormalizeAttention(wire.Entry.Attention, out var entryAttention)
            || !TryNormalizeVisual(wire.Entry.Visual, out var entryVisual)
            || entryVisual!.Icon != "entry"
            || entryVisual.Tone != entryAttention!.Primary
            || entryVisual.BorderColors.Count != entryAttention.Indicators.Count
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
            new ControlSurfaceEntry(
                wire.Entry.Id,
                wire.Entry.Label,
                entryAttention!,
                entryVisual!,
                new OpenProjectOverviewAction()),
            new ControlSurfaceView(wire.View.Level, wire.View.Title, tiles));
        return true;
    }

    private static Boolean TryNormalizeTile(WireTile wire, out ControlSurfaceTile? tile)
    {
        tile = null;
        if (!IsSafeTileId(wire.Id)
            || !IsLabel(wire.Label)
            || wire.IconPath is not null && !IsIconPath(wire.IconPath)
            || wire.Role is not null and not "coordinator"
            || !TryNormalizeVisual(wire.Visual, out var visual))
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

        AttentionSummary? attention = null;
        if (wire.Attention is not null
            && !TryNormalizeAttention(wire.Attention, out attention))
        {
            return false;
        }

        tile = new ControlSurfaceTile(
            wire.Id,
            wire.Label,
            wire.IconPath,
            wire.Status,
            wire.Role,
            attention,
            visual!,
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
                    when tile.Id == $"project:{projectAction.ProjectId}"
                        && tile.Attention is not null
                        && tile.Visual.Icon == "project"
                        && tile.Visual.Tone == tile.Attention.Primary
                        && tile.Visual.BorderColors.Count == tile.Attention.Indicators.Count => true,
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
            || tiles[backIndex].Role is not null
            || tiles[backIndex].Attention is not null
            || tiles[backIndex].Visual is not
            {
                Icon: "back",
                Tone: "navigation",
                BorderColors.Count: 0,
                Badge: "",
                WorkerIndicators.Count: 0,
            })
        {
            return false;
        }

        return tiles.Where((_, index) => index != backIndex).All(tile => tile switch
        {
            { Action: OpenCodexTaskAction taskAction, Attention: not null }
                when tile.Id == $"task:{taskAction.ThreadId}"
                    && tile.Status is not null
                    && TaskStatuses.Contains(tile.Status)
                    && IsTaskAttention(tile.Status, tile.Attention)
                    && tile.Visual.Icon == "task"
                    && tile.Visual.Tone == tile.Attention.Primary
                    && tile.Visual.BorderColors.Count == tile.Attention.Indicators.Count
                    && (tile.Role == "coordinator" || tile.Visual.WorkerIndicators.Count == 0)
                    && (tile.Role == "coordinator" || tile.IconPath is null) => true,
            _ => false,
        });
    }

    private static Boolean IsAction(WireAction action, String type) =>
        action.Type == type
            && action.Page is null
            && action.ProjectId is null
            && action.ThreadId is null;

    private static Boolean IsTaskAttention(String status, AttentionSummary attention)
    {
        var expected = status == "completed" ? "idle" : status;
        return attention.Primary == expected
            && attention.Indicators is [{ State: var state, Count: 1 }]
            && state == expected
            && attention.AdditionalStates == 0;
    }

    private static Boolean TryNormalizeAttention(
        WireAttention wire,
        out AttentionSummary? attention)
    {
        attention = null;
        if (!AttentionStates.Contains(wire.Primary)
            || wire.Indicators.Count is < 1 or > 3
            || wire.AdditionalStates is < 0 or > 5
            || wire.AdditionalStates > 0 && wire.Indicators.Count < 3
            || wire.Indicators[0].State != wire.Primary
            || wire.Indicators.Any(indicator =>
                !AttentionStates.Contains(indicator.State)
                || indicator.Count is < 1 or > 1_000_000)
            || wire.Indicators.Select(indicator => indicator.State)
                .Distinct(StringComparer.Ordinal).Count() != wire.Indicators.Count)
        {
            return false;
        }

        attention = new AttentionSummary(
            wire.Primary,
            wire.Indicators.Select(indicator =>
                new AttentionIndicator(indicator.State, indicator.Count)).ToArray(),
            wire.AdditionalStates);
        return true;
    }

    private static Boolean TryNormalizeVisual(
        WireVisual wire,
        out VisualPresentation? visual)
    {
        visual = null;
        if (!VisualIcons.Contains(wire.Icon)
            || !IsBoundedCue(wire.Glyph, 4)
            || wire.Tone != "navigation" && !AttentionStates.Contains(wire.Tone)
            || !IsColor(wire.BackgroundColor)
            || !IsColor(wire.ForegroundColor)
            || wire.BorderColors.Count > 3
            || wire.BorderColors.Any(color => !IsColor(color))
            || !IsBoundedCue(wire.Badge, 12, allowEmpty: true)
            || wire.WorkerIndicators.Count > 8
            || wire.WorkerIndicators.Any(indicator =>
                !AttentionStates.Contains(indicator.State)
                || indicator.Count is < 1 or > 1_000_000
                || !IsColor(indicator.Color)
                || indicator.Side is not ("left" or "right"))
            || wire.WorkerIndicators.Select(indicator => indicator.State)
                .Distinct(StringComparer.Ordinal).Count() != wire.WorkerIndicators.Count
            || !IsOrderedWorkerPresentation(wire.WorkerIndicators))
        {
            return false;
        }

        visual = new VisualPresentation(
            wire.Icon,
            wire.Glyph,
            wire.Tone,
            wire.BackgroundColor,
            wire.ForegroundColor,
            wire.BorderColors.ToArray(),
            wire.Badge,
            wire.WorkerIndicators.Select(indicator => new WorkerIndicatorPresentation(
                indicator.State,
                indicator.Count,
                indicator.Color,
                indicator.Side)).ToArray());
        return true;
    }

    private static Boolean IsOrderedWorkerPresentation(
        IReadOnlyList<WireWorkerIndicator> indicators)
    {
        var previous = -1;
        foreach (var indicator in indicators)
        {
            var rank = AttentionPrecedence[indicator.State];
            var expectedSide = indicator.State is "working" or "idle" ? "right" : "left";
            if (rank <= previous || indicator.Side != expectedSide)
            {
                return false;
            }
            previous = rank;
        }
        return true;
    }

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

    private static Boolean IsBoundedCue(String value, Int32 maximumLength, Boolean allowEmpty = false) =>
        (allowEmpty || value.Length > 0)
            && value.Length <= maximumLength
            && value.All(character => character is >= ' ' and <= '~');

    private static Boolean IsColor(String value) => HexColor().IsMatch(value);

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeIdentifier();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeTileId();

    [GeneratedRegex("^#[0-9A-F]{6}$", RegexOptions.CultureInvariant)]
    private static partial Regex HexColor();

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

        [JsonProperty("attention", Required = Required.Always)]
        public WireAttention Attention { get; init; } = new();

        [JsonProperty("visual", Required = Required.Always)]
        public WireVisual Visual { get; init; } = new();

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

        [JsonProperty("attention")]
        public WireAttention? Attention { get; init; }

        [JsonProperty("visual", Required = Required.Always)]
        public WireVisual Visual { get; init; } = new();

        [JsonProperty("action", Required = Required.Always)]
        public WireAction Action { get; init; } = new();
    }

    private sealed class WireAttention
    {
        [JsonProperty("primary", Required = Required.Always)]
        public String Primary { get; init; } = String.Empty;

        [JsonProperty("indicators", Required = Required.Always)]
        public IReadOnlyList<WireAttentionIndicator> Indicators { get; init; } = [];

        [JsonProperty("additionalStates", Required = Required.Always)]
        public Int32 AdditionalStates { get; init; }
    }

    private sealed class WireAttentionIndicator
    {
        [JsonProperty("state", Required = Required.Always)]
        public String State { get; init; } = String.Empty;

        [JsonProperty("count", Required = Required.Always)]
        public Int32 Count { get; init; }
    }

    private sealed class WireVisual
    {
        [JsonProperty("icon", Required = Required.Always)]
        public String Icon { get; init; } = String.Empty;

        [JsonProperty("glyph", Required = Required.Always)]
        public String Glyph { get; init; } = String.Empty;

        [JsonProperty("tone", Required = Required.Always)]
        public String Tone { get; init; } = String.Empty;

        [JsonProperty("backgroundColor", Required = Required.Always)]
        public String BackgroundColor { get; init; } = String.Empty;

        [JsonProperty("foregroundColor", Required = Required.Always)]
        public String ForegroundColor { get; init; } = String.Empty;

        [JsonProperty("borderColors", Required = Required.Always)]
        public IReadOnlyList<String> BorderColors { get; init; } = [];

        [JsonProperty("badge", Required = Required.Always)]
        public String Badge { get; init; } = String.Empty;

        [JsonProperty("workerIndicators", Required = Required.Always)]
        public IReadOnlyList<WireWorkerIndicator> WorkerIndicators { get; init; } = [];
    }

    private sealed class WireWorkerIndicator
    {
        [JsonProperty("state", Required = Required.Always)]
        public String State { get; init; } = String.Empty;

        [JsonProperty("count", Required = Required.Always)]
        public Int32 Count { get; init; }

        [JsonProperty("color", Required = Required.Always)]
        public String Color { get; init; } = String.Empty;

        [JsonProperty("side", Required = Required.Always)]
        public String Side { get; init; } = String.Empty;
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

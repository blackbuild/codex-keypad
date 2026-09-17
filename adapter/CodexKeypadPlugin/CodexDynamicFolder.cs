namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using CodexKeypad.Core;
using Loupedeck;

public sealed class CodexDynamicFolder : PluginDynamicFolder
{
    private static readonly TimeSpan RefreshInterval = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan StateFreshness = TimeSpan.FromSeconds(2);
    private const Int64 MaximumIconBytes = 1024 * 1024;

    private readonly Object _sync = new();
    private Timer? _refreshTimer;
    private Process? _sidecar;
    private String? _statePath;
    private String? _actionPath;
    private ControlSurfaceState? _state;

    public CodexDynamicFolder()
    {
        this.DisplayName = "Codex";
        this.GroupName = "Codex";
    }

    public override PluginDynamicFolderNavigation GetNavigationArea(DeviceType _) =>
        PluginDynamicFolderNavigation.None;

    public override String GetButtonDisplayName(PluginImageSize _) =>
        this.WithState(state => state?.Entry.Label ?? "Codex · unavailable");

    public override BitmapImage GetButtonImage(PluginImageSize imageSize)
    {
        return this.WithState(state => state is null
            ? CreateUnavailableImage(imageSize)
            : CreateVisualImage(state.Entry.Label, null, state.Entry.Visual, imageSize));
    }

    public override IEnumerable<String> GetButtonPressActionNames(DeviceType _) =>
        this.WithState(state => state?.View.Tiles
            .Select(tile => this.CreateCommandName(tile.Id))
            .ToArray() ?? []);

    public override String GetCommandDisplayName(String actionParameter, PluginImageSize _) =>
        this.WithState(state => state?.View.Tiles
            .SingleOrDefault(tile => tile.Id == actionParameter)?.Label
            ?? "Unavailable");

    public override BitmapImage GetCommandImage(String actionParameter, PluginImageSize imageSize) =>
        this.WithState(state =>
        {
            var tile = state?.View.Tiles.SingleOrDefault(tile => tile.Id == actionParameter);
            return tile is null
                ? null
                : CreateVisualImage(tile.Label, tile.IconPath, tile.Visual, imageSize);
        }) ?? null!;

    public override void RunCommand(String actionParameter)
    {
        var action = this.WithState(state => state?.View.Tiles
            .SingleOrDefault(tile => tile.Id == actionParameter)?.Action);
        var actionPath = this._actionPath;
        if (action is not null && actionPath is not null)
        {
            RelayAction(actionPath, action);
        }
    }

    public override Boolean Load()
    {
        try
        {
            var channel = $"codex-keypad-{Environment.ProcessId}-{Guid.NewGuid():N}";
            this._statePath = Path.Combine(Path.GetTempPath(), $"{channel}-state.json");
            this._actionPath = Path.Combine(Path.GetTempPath(), $"{channel}-action.json");
            this._sidecar = StartSidecar(this.Plugin?.AssemblyFilePath, this._statePath, this._actionPath);
            this._refreshTimer = new Timer(
                _ => this.RefreshState(),
                null,
                TimeSpan.Zero,
                RefreshInterval);
            return true;
        }
        catch (Exception error)
        {
            Trace.TraceError($"Unable to start the Codex Keypad state adapter: {error}");
            return false;
        }
    }

    public override Boolean Activate()
    {
        var reset = this.WithState(state => state?.Entry.Action);
        if (reset is not null && this._actionPath is not null)
        {
            RelayAction(this._actionPath, reset);
        }
        return true;
    }

    public override Boolean Unload()
    {
        this._refreshTimer?.Dispose();
        this._refreshTimer = null;

        try
        {
            if (this._sidecar is { HasExited: false })
            {
                this._sidecar.Kill(entireProcessTree: true);
                this._sidecar.WaitForExit(2_000);
            }
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to stop the Codex Keypad state adapter cleanly: {error}");
        }
        finally
        {
            this._sidecar?.Dispose();
            this._sidecar = null;
        }

        DeleteTemporaryFile(this._statePath);
        DeleteTemporaryFile(this._actionPath);
        return true;
    }

    private static Process StartSidecar(String? pluginAssemblyFilePath, String statePath, String actionPath)
    {
        var assemblyDirectory = Path.GetDirectoryName(pluginAssemblyFilePath)
            ?? throw new InvalidOperationException("The plugin assembly location is unavailable");
        var sidecarPath = Path.GetFullPath(Path.Combine(assemblyDirectory, "..", "node", "live-state.mjs"));
        if (!File.Exists(sidecarPath))
        {
            throw new FileNotFoundException("The packaged Codex Keypad state adapter is missing", sidecarPath);
        }

        var nodeExecutable = new[] { "/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node" }
            .FirstOrDefault(File.Exists);
        var startInfo = new ProcessStartInfo
        {
            FileName = nodeExecutable ?? "/usr/bin/env",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
        };
        if (nodeExecutable is null)
        {
            startInfo.ArgumentList.Add("node");
        }
        startInfo.ArgumentList.Add(sidecarPath);
        startInfo.ArgumentList.Add("--output");
        startInfo.ArgumentList.Add(statePath);
        startInfo.ArgumentList.Add("--actions");
        startInfo.ArgumentList.Add(actionPath);

        var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("The Codex Keypad state adapter did not start");
        process.ErrorDataReceived += (_, event_) =>
        {
            if (!String.IsNullOrWhiteSpace(event_.Data))
            {
                Trace.TraceWarning($"Codex Keypad state adapter: {event_.Data}");
            }
        };
        process.BeginErrorReadLine();
        return process;
    }

    private static void DeleteTemporaryFile(String? path)
    {
        if (path is null)
        {
            return;
        }

        try
        {
            File.Delete(path);
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to remove temporary Codex Keypad state: {error}");
        }
    }

    private static void RelayAction(String path, SemanticAction action)
    {
        try
        {
            ControlSurfaceActionPublisher.Publish(path, action);
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to relay a Codex Keypad action: {error}");
        }
    }

    private static BitmapImage CreateVisualImage(
        String label,
        String? iconPath,
        VisualPresentation visual,
        PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        var background = ParseColor(visual.BackgroundColor);
        var foreground = ParseColor(visual.ForegroundColor);
        builder.Clear(background);

        var hasCustomIcon = TryLoadIcon(iconPath, out var icon);
        if (hasCustomIcon)
        {
            builder.SetBackgroundImage(icon!, true);
        }
        else
        {
            builder.DrawText(
                visual.Glyph,
                0,
                5,
                builder.Width,
                Math.Max(1, builder.Height / 2 - 5),
                foreground,
                fontSize: 24);
        }

        DrawAttentionSegments(builder, visual.BorderColors);
        DrawBadge(builder, visual.Badge, background, foreground);

        var labelTop = builder.Height / 2;
        builder.FillRectangle(0, labelTop, builder.Width, builder.Height - labelTop, background);
        builder.DrawText(
            label,
            3,
            labelTop + 2,
            Math.Max(1, builder.Width - 6),
            Math.Max(1, builder.Height - labelTop - 4),
            foreground,
            fontSize: 12);
        return builder.ToImage();
    }

    private static Boolean TryLoadIcon(String? iconPath, out BitmapImage? icon)
    {
        icon = null;
        try
        {
            if (iconPath is null
                || !File.Exists(iconPath)
                || new FileInfo(iconPath).Length > MaximumIconBytes
                || !BitmapImage.TryCreateFromFile(iconPath, out icon))
            {
                return false;
            }
            return true;
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to load a Codex Keypad custom icon: {error}");
            return false;
        }
    }

    private static void DrawAttentionSegments(
        BitmapBuilder builder,
        IReadOnlyList<String> colors)
    {
        for (var index = 0; index < colors.Count; index += 1)
        {
            var start = index * builder.Width / colors.Count;
            var end = (index + 1) * builder.Width / colors.Count;
            builder.FillRectangle(start, 0, Math.Max(1, end - start), 4, ParseColor(colors[index]));
        }
    }

    private static void DrawBadge(
        BitmapBuilder builder,
        String badge,
        BitmapColor background,
        BitmapColor foreground)
    {
        if (badge.Length == 0)
        {
            return;
        }
        var badgeWidth = Math.Min(builder.Width, Math.Max(24, badge.Length * 9 + 6));
        builder.FillRectangle(builder.Width - badgeWidth, 4, badgeWidth, 20, background);
        builder.DrawText(
            badge,
            builder.Width - badgeWidth,
            5,
            badgeWidth,
            18,
            foreground,
            fontSize: 12);
    }

    private static BitmapColor ParseColor(String color) =>
        BitmapColor.FromRgb(Convert.ToUInt32(color[1..], 16));

    private static BitmapImage CreateUnavailableImage(PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        builder.Clear(BitmapColor.FromRgb(0x3F3F46));
        builder.DrawText("?\nCodex unavailable", BitmapColor.White, fontSize: 16);
        return builder.ToImage();
    }

    private void RefreshState()
    {
        var nextState = this.ReadFreshState();

        var changed = false;
        lock (this._sync)
        {
            if (this._state?.Revision != nextState?.Revision)
            {
                this._state = nextState;
                changed = true;
            }
        }

        if (changed)
        {
            this.ButtonActionNamesChanged();
            foreach (var tile in nextState?.View.Tiles ?? [])
            {
                this.CommandImageChanged(tile.Id);
            }
            if (this.Plugin is not null)
            {
                this.Plugin.OnActionImageChanged(this.CommandName, String.Empty, true);
            }
        }
    }

    private ControlSurfaceState? ReadFreshState()
    {
        try
        {
            var statePath = this._statePath;
            if (this._sidecar is not { HasExited: false }
                || statePath is null
                || !File.Exists(statePath)
                || DateTime.UtcNow - File.GetLastWriteTimeUtc(statePath) > StateFreshness
                || !ControlSurfaceContract.TryRead(statePath, out var state))
            {
                return null;
            }
            return state;
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to read fresh Codex Keypad state: {error}");
            return null;
        }
    }

    private TResult WithState<TResult>(Func<ControlSurfaceState?, TResult> access)
    {
        lock (this._sync)
        {
            return access(this._state);
        }
    }
}

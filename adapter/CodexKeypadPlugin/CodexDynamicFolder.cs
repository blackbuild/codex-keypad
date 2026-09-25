namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using CodexKeypad.Core;
using Loupedeck;

public sealed class CodexDynamicFolder : PluginDynamicFolder
{
    private const String DynamicFolderActionName = "#DynamicFolder";
    private static readonly TimeSpan RefreshInterval = TimeSpan.FromMilliseconds(250);
    private static readonly TimeSpan StateFreshness = TimeSpan.FromSeconds(2);
    private readonly Object _sync = new();
    private Timer? _refreshTimer;
    private Process? _sidecar;
    private String? _statePath;
    private String? _actionPath;
    private ControlSurfaceState? _state;
    private Boolean _awaitingOverview;

    public CodexDynamicFolder()
    {
        this.DisplayName = "Codex";
        this.GroupName = "Codex";
    }

    public override PluginDynamicFolderNavigation GetNavigationArea(DeviceType _) =>
        PluginDynamicFolderNavigation.None;

    public override String GetButtonDisplayName(PluginImageSize _) =>
        this.WithState(state => state?.Entry.Label ?? "Codex");

    public override BitmapImage GetButtonImage(PluginImageSize imageSize)
    {
        return this.WithState(state => state is null
            ? ControlSurfaceBitmapRenderer.RenderUnavailable(imageSize)
            : ControlSurfaceBitmapRenderer.Render(
                PackagedCodexIconPath(this.Plugin?.AssemblyFilePath),
                null,
                state.Entry.Visual,
                imageSize));
    }

    public override IEnumerable<String> GetButtonPressActionNames(DeviceType _) =>
        this.WithState(state => this._awaitingOverview ? [] : state?.View.Tiles
            .Select(tile => this.CreateCommandName(tile.Id))
            .ToArray() ?? []);

    public override String GetCommandDisplayName(String actionParameter, PluginImageSize _) =>
        this.WithState(state => (this._awaitingOverview
            ? null
            : state?.View.Tiles.SingleOrDefault(tile => tile.Id == actionParameter)?.Label)
            ?? "Unavailable");

    public override BitmapImage GetCommandImage(String actionParameter, PluginImageSize imageSize) =>
        this.WithState(state =>
        {
            var tile = this._awaitingOverview
                ? null
                : state?.View.Tiles.SingleOrDefault(tile => tile.Id == actionParameter);
            return tile is null
                ? null
                : ControlSurfaceBitmapRenderer.Render(
                    tile.IconPath,
                    tile.Role,
                    tile.Visual,
                    imageSize);
        }) ?? null!;

    public override void RunCommand(String actionParameter)
    {
        var action = this.WithState(state => state?.View.Tiles
            .SingleOrDefault(tile => !this._awaitingOverview && tile.Id == actionParameter)?.Action);
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
        lock (this._sync)
        {
            this._awaitingOverview = this._state?.View.Level != "project-overview";
        }
        this.ButtonActionNamesChanged();
        this.ResetToOverview();
        return true;
    }

    public override Boolean Deactivate()
    {
        lock (this._sync)
        {
            this._awaitingOverview = true;
        }
        this.ResetToOverview();
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

    private static String? PackagedCodexIconPath(String? pluginAssemblyFilePath)
    {
        var assemblyDirectory = Path.GetDirectoryName(pluginAssemblyFilePath);
        return assemblyDirectory is null
            ? null
            : Path.GetFullPath(Path.Combine(
                assemblyDirectory,
                "..",
                "metadata",
                "CodexMark256x256.png"));
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

    private void ResetToOverview()
    {
        var reset = this.WithState(state => state?.Entry.Action);
        if (reset is not null && this._actionPath is not null)
        {
            RelayAction(this._actionPath, reset);
        }
    }

    private void RefreshState()
    {
        var nextState = this.ReadFreshState();

        var changed = false;
        lock (this._sync)
        {
            var overviewArrived = this._awaitingOverview
                && nextState?.View.Level == "project-overview";
            if (overviewArrived)
            {
                this._awaitingOverview = false;
            }
            if (this._state?.Revision != nextState?.Revision || overviewArrived)
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
            this.InvalidateRootImage();
        }
    }

    private void InvalidateRootImage()
    {
        if (this.Plugin is not null)
        {
            // The profile binds every dynamic-folder root through the SDK's
            // #DynamicFolder action and uses Name as that action's parameter.
            // CommandName belongs only to the inner tiles.
            InvalidateDynamicFolderRoot(
                this.Name,
                this.Plugin.OnActionImageChanged);
        }
    }

    private static void InvalidateDynamicFolderRoot(
        String folderName,
        Action<String, String, Boolean> invalidate) =>
        invalidate(DynamicFolderActionName, folderName, false);

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

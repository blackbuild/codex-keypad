namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using System.Reflection;
using CodexKeypad.Core;
using Loupedeck;

public sealed class CodexDynamicFolder : PluginDynamicFolder
{
    private static readonly TimeSpan RefreshInterval = TimeSpan.FromSeconds(1);

    private readonly Object _sync = new();
    private readonly ControlSurfaceNavigator _navigator = new();
    private Timer? _refreshTimer;
    private Process? _sidecar;
    private String? _statePath;

    public CodexDynamicFolder()
    {
        this.DisplayName = "Codex";
        this.GroupName = "Codex";
    }

    public override PluginDynamicFolderNavigation GetNavigationArea(DeviceType _) =>
        PluginDynamicFolderNavigation.None;

    public override String GetButtonDisplayName(PluginImageSize _) =>
        this.ReadNavigator(navigator => navigator.EntryLabel);

    public override IEnumerable<String> GetButtonPressActionNames(DeviceType _) =>
        this.ReadNavigator(navigator => navigator.GetTiles()
            .Select(tile => this.CreateCommandName(tile.ActionParameter))
            .ToArray());

    public override String GetCommandDisplayName(String actionParameter, PluginImageSize _) =>
        this.ReadNavigator(navigator => navigator.GetTiles()
            .SingleOrDefault(tile => tile.ActionParameter == actionParameter)?.Label
            ?? "Unavailable");

    public override void RunCommand(String actionParameter)
    {
        var outcome = this.ReadNavigator(navigator => navigator.Handle(actionParameter));
        switch (outcome.Kind)
        {
            case NavigationOutcomeKind.Refresh:
                this.ButtonActionNamesChanged();
                break;
            case NavigationOutcomeKind.Close:
                this.Close();
                break;
            case NavigationOutcomeKind.OpenCodexTask:
                this.OpenCodexTask(outcome.ThreadId);
                break;
            case NavigationOutcomeKind.Ignored:
            default:
                break;
        }
    }

    public override Boolean Load()
    {
        try
        {
            this._statePath = Path.Combine(
                Path.GetTempPath(),
                $"codex-keypad-{Environment.ProcessId}-{Guid.NewGuid():N}.json");
            this._sidecar = StartSidecar(this._statePath);
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

        if (this._statePath is not null)
        {
            try
            {
                File.Delete(this._statePath);
            }
            catch (Exception error)
            {
                Trace.TraceWarning($"Unable to remove the temporary Codex Keypad state file: {error}");
            }
        }
        return true;
    }

    private static Process StartSidecar(String statePath)
    {
        var assemblyDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
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

    private void RefreshState()
    {
        var statePath = this._statePath;
        if (statePath is null || !ControlSurfaceContract.TryRead(statePath, out var state) || state is null)
        {
            return;
        }

        var changed = false;
        lock (this._sync)
        {
            if (this._navigator.Revision != state.Revision)
            {
                this._navigator.Update(state);
                changed = true;
            }
        }

        if (changed)
        {
            this.ButtonActionNamesChanged();
        }
    }

    private void OpenCodexTask(String? threadId)
    {
        if (threadId is null || !CodexThreadDeepLink.TryCreate(threadId, out var uri) || uri is null)
        {
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "/usr/bin/open",
            UseShellExecute = false,
        };
        startInfo.ArgumentList.Add("-b");
        startInfo.ArgumentList.Add("com.openai.codex");
        startInfo.ArgumentList.Add(uri.AbsoluteUri);
        Process.Start(startInfo)?.Dispose();
    }

    private TResult ReadNavigator<TResult>(Func<ControlSurfaceNavigator, TResult> read)
    {
        lock (this._sync)
        {
            return read(this._navigator);
        }
    }
}

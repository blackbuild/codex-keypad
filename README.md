# Codex Keypad

An experimental macOS Logi Actions plugin for navigating Codex Desktop from an
MX Keypad. The live adapter provides the first complete three-level path:

1. assign the global Codex dynamic-folder action to an ordinary keypad profile;
2. open its one configured project tile;
3. open the one currently active task in that project.

Back returns from the task view to the project overview and closes the overview
at its root. The device Home button exits the dynamic folder normally. State is
refreshed once per second without reloading the plugin.

## Architecture

- `src/codex/` isolates the unstable, read-only Codex SQLite and rollout-journal
  details. A configured project root limits the live task selection to that
  project.
- `src/control-surface/` owns the versioned normalized views, semantic navigation
  state machine, exact-task opening, and atomic state/action handoff.
- `adapter/CodexKeypad.Core/` strictly validates the normalized JSON and relays
  only its closed set of typed semantic actions.
- `adapter/CodexKeypadPlugin/` is the thin Logitech C# dynamic-folder adapter. It
  starts the fixed packaged TypeScript sidecar, renders its current view, relays
  button actions, handles the SDK-specific close effect, and invalidates the
  global entry image when state changes. It never executes a command from state.

The original TypeScript startup-snapshot tracer bullet remains in `index.ts` and
`src/logitech/`. It can still be built and packed independently while the live
C# adapter becomes the primary package.

## Requirements

- macOS with Codex Desktop
- Logi Options+ with Plugin API 6.4.1 or newer
- Node.js 22 or newer in `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, or the
  Logi Plugin Service `PATH`
- .NET 10 SDK for development builds

The installed Logitech SDK assemblies are read from
`/Applications/Utilities/LogiPluginService.app/Contents/MonoBundle/`.

## Configure one project

`CODEX_KEYPAD_PROJECT_ROOT` is required and must be visible to the Logi Plugin
Service process. It is matched exactly against the Codex task working directory.
Set it before starting Options+; for a shell-launched development smoke test:

```sh
export CODEX_KEYPAD_PROJECT_ROOT=/absolute/path/to/the/project-workspace
```

The optional `CODEX_KEYPAD_PROJECT_ID` and `CODEX_KEYPAD_PROJECT_NAME` variables
control the normalized tile identity and label. They default to `codex-keypad`
and `Codex Keypad`.

By default, the state adapter finds the highest-versioned `state_*.sqlite` and
`thread_history_*.sqlite` files under `CODEX_HOME` or `~/.codex`. Tests may use
`CODEX_STATE_DB` and `CODEX_THREAD_HISTORY_DB` to select fixtures explicitly.

## Build and test

```sh
npm install
npm test
npm run build
```

`npm test` runs the TypeScript behavior tests and the executable C# contract
harness. `npm run build` typechecks and bundles both TypeScript entry points,
then compiles and assembles the C# plugin in `dist-adapter/`.

Create the installable C# package with:

```sh
npm run build:pack
```

The result is `artifacts/CodexKeypad_0_2_0.lplug4`. Install it, find the Codex
dynamic-folder action in Options+, and assign that action to a key in a normal
profile.

The preserved TypeScript tracer bullet can still be packed with:

```sh
npm run pack:tracer
```

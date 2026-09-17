# Codex Keypad

An experimental macOS Logi Actions plugin for navigating Codex Desktop from an
MX Keypad. The live adapter provides a three-level path:

1. assign the global Codex dynamic-folder action to an ordinary keypad profile;
2. choose from the configured project tiles;
3. choose from the selected project's Codex tasks and open the exact task.

Back returns from the task view to the project overview and closes the overview
at its root. The device Home button exits the dynamic folder normally. State is
refreshed four times per second without reloading the plugin.

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

## Requirements

- macOS with Codex Desktop
- Logi Options+ with Plugin API 6.4.1 or newer
- Node.js 22 or newer in `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, or the
  Logi Plugin Service `PATH`
- .NET 10 SDK for development builds

The installed Logitech SDK assemblies are read from
`/Applications/Utilities/LogiPluginService.app/Contents/MonoBundle/`.

## Configure projects

For an ordinary Options+ launch, create the persistent per-user configuration
file at `~/Library/Application Support/Codex Keypad/config.json`:

```sh
mkdir -p "$HOME/Library/Application Support/Codex Keypad"
cat > "$HOME/Library/Application Support/Codex Keypad/config.json" <<'JSON'
{
  "coordinatorTaskPattern": "* Hive",
  "projects": [
    {
      "id": "codex-keypad",
      "name": "Codex Keypad",
      "root": "/absolute/path/to/codex-project",
      "repositories": [
        "/absolute/path/to/codex-project/repo"
      ],
      "coordinatorTaskId": "codex://threads/01example-coordinator-task-id",
      "coordinatorTaskPattern": "Codex Keypad Hive*",
      "icon": "/absolute/path/to/codex-keypad.png"
    },
    {
      "id": "another-project",
      "name": "Another Project",
      "root": "/absolute/path/to/another-project"
    }
  ]
}
JSON
```

Each project needs a unique stable `id`, a display `name`, and an absolute `root`
for the Codex project directory used as the task working directory. An optional
`repositories` array names up to 16 repository working-tree roots contained in or
otherwise associated with that Codex project. Do not point it at `.git`; the
adapter resolves each repository's Git metadata and automatically associates its
linked worktrees. This lets a wrapper-style project include both Hive tasks rooted
at the wrapper and worker tasks rooted at nested repositories or worktrees. An
optional `coordinatorTaskId` identifies the project's stable Hive/coordinator
task. It accepts either the raw task ID or the `codex://threads/...` deep link
copied from Codex. A configuration-level `coordinatorTaskPattern` supplies a
default for all projects, while a project-level pattern overrides that default.
Patterns are case-insensitive, match the complete task name, and use `*` for any
text and `?` for one character. An exact matching ID wins; if that ID is absent,
the first pattern match in deterministic recency/identity order becomes the
coordinator. Multiple matches therefore need no conflict handling. When a
coordinator is present, it is pinned before Back in the selected-project view and
uses the project's icon; the remaining tasks retain deterministic recency
ordering. An optional `icon` is an absolute path to a PNG of at most 1 MiB.
Project tiles follow the configuration order; the Logitech runtime uses the
device's native page controls when they do not fit on one touch page.

The project overview contains only project tiles. Its parent is the surrounding
Logitech profile, so the device's native Back/Home control exits the dynamic
folder without consuming an overview tile.

The sidecar re-reads configuration and live Codex state on every refresh, so
adding, removing, renaming, reordering, or changing an icon path does not require
restarting Options+. A missing or invalid configuration makes the state expire
to unavailable instead of retaining a misleading startup snapshot. A project
whose Codex state cannot be read remains visible with `Count unavailable`; an
unreadable icon falls back to the text tile. The issue 4 single-project
`{"projectRoot":"/absolute/path"}` form remains supported for upgrades.

The selected-project view includes up to 256 non-archived top-level Codex tasks,
ordered by most-recent update and then stable task identity. The normalized view
publishes that complete ordered list and lets the Logitech runtime create touch
pages navigated by the device's native page controls; it does not add synthetic
Previous or Next tiles. Completed tasks remain visible with their normalized
state. A task with a present but unrecognized persisted status remains visible as
`State unavailable`; the raw status is never published. Archived or deleted tasks
leave the view and newly created tasks appear.
Vacated positions are reused by the next task in the same ordering, while
unpopulated keypad positions have no action. Task labels use the Codex task name,
or a bounded opaque task identifier when no name exists; raw prompt and transcript
text are never used as the fallback label. In the selected-project task view,
the explicit Back tile performs the product-level task-to-project transition;
the SDK's native Back/Home behavior closes the entire dynamic folder instead.
With a matching `coordinatorTaskId`, the published leading controls are
coordinator then Back, so the runtime's prepended native Home control produces a
first row of Home, coordinator, and Back. If the configured coordinator is not a
current included task, Back remains first and all tasks use the normal ordering.

An active worker is an in-progress, top-level Codex Desktop task created or
forked by an agent, or handed off to one. User/coordinator and automation tasks
do not inflate the worker badge, and an unrecognized task status is not counted
as evidence of active work. A missing project root or exclusively stale or
implausibly future-dated worker evidence is shown as `Count unavailable` rather
than `Idle`. When current workers are returned alongside unusable worker state,
the current workers remain visible as a lower bound such as `2+ active`.

For a shell-launched sidecar smoke test, `CODEX_KEYPAD_PROJECT_ROOT` remains an
override. A shell `export` does not configure an already-running, GUI-launched
Logi Plugin Service, so it is not the normal Options+ configuration mechanism.
The optional `CODEX_KEYPAD_PROJECT_ID`, `CODEX_KEYPAD_PROJECT_NAME`, and
`CODEX_KEYPAD_PROJECT_ICON` environment variables control the normalized tile
identity, label, and PNG for such development runs. The optional
`CODEX_KEYPAD_COORDINATOR_TASK_ID` pins a matching coordinator task, with
`CODEX_KEYPAD_COORDINATOR_TASK_PATTERN` as its wildcard fallback. They default to
`codex-keypad`, `Codex Keypad`, no custom icon, and no pinned coordinator.

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
harness. `npm run build` typechecks and bundles the TypeScript live-state
sidecar, then compiles and assembles the C# plugin in `dist-adapter/`.

Create the installable C# package with:

```sh
npm run build:pack
```

The result is `artifacts/CodexKeypad_0_2_0.lplug4`. Install it, find the Codex
dynamic-folder action in Options+, and assign that action to a key in a normal
profile.

Automated tests and packaged-sidecar checks cover the non-device behavior. The
issue #4 package was also exercised on a physical MX Keypad: the assignable Codex
entry, project and task navigation, exact-task deep link, live active/idle
refresh, one-level Back behavior, and device Home exit all worked without
restarting Options+. This bounded smoke test is the hardware evidence; automated
or simulated checks are not treated as substitutes for it.

The maintainer confirmed the issue #6 multi-task physical demonstration through
schema v5: exact task opening, native pagination, live completion/removal/addition,
inert empty slots, project/task navigation, and the absence of synthetic page or
project-overview Back tiles. The schema v6 coordinator-ordering follow-up requires
one focused device confirmation that the first task row is native Home,
project-icon coordinator, and Back.

# Codex Desktop for MX Keypad

An experimental macOS Logi Actions plugin that puts the currently working
Codex Desktop tasks on the nine MX Keypad LCD keys. Pressing a populated slot
opens that task with Codex's `codex://threads/<thread-id>` deep link.

This is a tracer bullet, not yet a finished status dashboard. The current
Node.js Logi Actions SDK registers actions only while the plugin starts, so the
slot labels are a startup snapshot. Restart or reload the plugin to refresh
them. A key press still opens the exact task shown when that snapshot was made.

## Architecture

- `src/codex/` owns the unstable Codex persistence details. It reads the local
  state and thread-history SQLite databases in read-only mode, validates the
  matching rollout's bounded `session_meta` record, excludes subagents and
  non-Desktop sessions, and returns UI-neutral `CodexTask` values.
- `src/logitech/` maps up to nine `CodexTask` values onto stable Logitech action
  names (`open_active_task_1` through `open_active_task_9`). It knows nothing
  about SQLite or Codex journals.
- `src/macos/` validates a thread ID and opens the deep link without invoking a
  shell.

The task status model already reserves approval and input states, but this
first slice deliberately emits only `working`. Later lifecycle parsing can
change inside the Codex adapter without changing the Logitech actions.

The accepted live-control-surface direction and its implementation slices are
described in [the roadmap](docs/roadmap.md).

## Requirements

- macOS with Codex Desktop
- Logi Options+ 2.2 or newer (Plugin API 6.3 introduced macOS support)
- Node.js 22 or newer

By default, the adapter finds the highest-versioned `state_*.sqlite` and
`thread_history_*.sqlite` files under `CODEX_HOME` or `~/.codex`. For fixtures
or unusual installations, set `CODEX_STATE_DB` and
`CODEX_THREAD_HISTORY_DB` to explicit files.

## Getting started

Install dependencies:

```
npm install
```

Run the adapter and action tests:

```
npm test
```

Build the plugin:

```
npm run build
```

Link it to Logi Plugin Service. The plugin should appear in the "All Actions"
section in Options+; assign its nine stable task-slot actions to the nine LCD
keys:

```
npm run link
```

Unlink it again with:

```
npm run unlink
```

## Package the plugin

Create a distributable `.lplug4` file with:

```
npm run build:pack
```

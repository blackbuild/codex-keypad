# Architecture

Codex Keypad is a programmable hardware control surface for observing and acting
on Codex work. The initial device adapter targets Logitech MX Keypad on macOS, but
the product core must not depend on one device, one handoff transport, or a
particular local workspace layout.

## Product boundaries

- The product does not require the `repo/` and `agent/` split-directory layout.
- A handoff directory inside project memory is one dogfood configuration, not an
  adoption prerequisite.
- Codex persistence parsing stays isolated from Logitech UI and action code.
- Device adapters consume validated normalized state, not raw agent output.
- Hardware input produces semantic actions rather than arbitrary commands.
- Persistent public configuration belongs to the repository or conventional
  application configuration. Ephemeral coordination and observations may live in
  a configured handoff transport.

## First live path

The live adapter uses a C# dynamic-folder package. A fixed TypeScript sidecar owns
the semantic navigation state machine and publishes its current view for the
configured projects and bounded non-archived tasks in the selected project as
versioned, normalized JSON. It also owns deterministic project/task order,
slot reuse, exact-task validation, canonical visual-token values, and semantic
icon roles. The C#
adapter strictly validates the contract's versioned structure, bounds, tile
roles, and semantic-action relationships without reconstructing TypeScript-owned
visual policy. It exposes the complete ordered action list, renders the packaged
Codex entry mark, maps remaining semantic icon roles and the entry fallback to
device-specific vector primitives, renders configured project icons and the
normalized presentation, and relays typed semantic action
requests back to TypeScript. The Logitech
runtime creates overflow touch pages and uses the device's native page controls;
the product does not add synthetic Previous or Next tiles.

A configured project root is the Codex task working directory. Optional
repository roots extend task association to nested or otherwise related Git
working trees and all linked worktrees discovered from their Git metadata. The
configuration names repository working trees rather than `.git` internals, and
this association remains owned by the Codex state-source boundary.
An optional explicit coordinator task identity distinguishes the stable Hive from
delegated tasks that may share the same wrapper working directory. It accepts a
raw ID or Codex thread deep link. A case-insensitive wildcard pattern provides a
durable fallback across coordinator replacement: project patterns override the
configuration-level default, and the first match in deterministic task order is
selected. When present, the coordinator is pinned before the semantic Up tile
and receives the project icon; all remaining tasks retain recency/identity
ordering. This avoids guessing from shared working directories while allowing a
stable policy independent of one task ID.
The device Home behavior and the close effect are owned by the Logitech runtime.
Accordingly, the project overview contains no redundant product Up tile; native
Back/Home exits to the surrounding Logitech profile. The selected-project task
view retains one semantic Up tile because it returns to the project overview
without closing the dynamic folder.
The issue 4 one-project path completed its bounded physical-device smoke test.
The superseded TypeScript startup-snapshot plugin was removed after that
validation, leaving the live adapter as the single package path. The issue 5
bounded physical-device demonstration covered simultaneous project tiles in
configured order, project/task/Up navigation, live rename, reorder and removal,
and a worker count from a linked Codex worktree without restarting Options+.
Custom project icons and multi-page project navigation remain automated-only
evidence for issue 5.

TypeScript accepts only the normalized `open-project-overview`, `open-task-view`,
and `open-codex-task` requests. Project routes must match the current
configuration, and the task action must match a current task in the selected
project. Pagination remains native device navigation rather than a semantic
product action. Tasks are opened by the existing
shell-free, validated Codex deep-link adapter. Unknown action types and unknown
JSON members are rejected. Task labels use normalized task names or an opaque
identifier fallback, never raw prompt or transcript content. Attention
aggregation uses the schema-v8 defaults below; agent-customized layouts remain a
later roadmap slice.

## Target navigation model

The live control surface has three levels:

```text
Normal keypad profile
└── Codex entry tile                 Level 0: combined state of all projects
    └── Project overview             Level 1: one tile per configured project
        └── Selected-project tasks   Level 2: one tile per task by default
```

The Level 0 entry tile is assignable to an ordinary, non-Codex-centric keypad
profile. It opens one plugin-controlled dynamic workspace. Within that workspace,
selecting a project replaces the project overview with the selected project's task
view; Up returns to the project overview and the device's normal Home behavior
exits the workspace.

Project and coordinator are product terms. A user may label a coordinator as a
Hive, but the product does not require that vocabulary.

## Runtime direction

The normalized project, task, attention, layout, and semantic-action contracts
remain in TypeScript. Codex and external-system adapters produce those contracts;
handoff transports carry them without becoming sources of authority.

The live Logitech adapter is a thin C# dynamic-folder plugin. Logitech's Node SDK
does not expose the dynamic-folder layout and image invalidation needed for live
LCD views; the C# SDK documents that capability. This split keeps
Logitech-specific rendering out of the product core while retaining the
TypeScript-owned normalized state and navigation.

References:

- [Logitech Node.js SDK](https://logitech.github.io/actions-sdk-docs/nodejs/)
- [Logitech dynamic folders](https://logitech.github.io/actions-sdk-docs/csharp/plugin-features/implementing-dynamic-folders/)

## State and action flow

```text
Codex / review providers / validated handoff
                  │
                  ▼
       normalized TypeScript state
                  │
                  ▼
        thin C# Logitech adapter
                  │
                  ▼
 Level 0 entry → Level 1 projects → Level 2 tasks
                  │
                  ▼
       allowlisted semantic actions
```

Task state aggregates to project state, and project state aggregates to the global
entry tile. Concurrent attention must use deterministic visual composition rather
than silently discarding conditions. Unknown or stale state must not be rendered as
confirmed healthy state. The schema-v8 default tokens, precedence, bounded
composition, fallback icons, and contrast behavior are specified in
[default-visual-system.md](default-visual-system.md).

Agent-requested layout changes are optional declarative inputs. They pass through
schema and policy validation and may select only allowlisted presentation choices
and semantic actions. The default selected-project layout remains one button per
task, and no handoff payload may execute an arbitrary command.

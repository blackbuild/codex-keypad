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
nine-key page selection, live page clamping, and exact-task validation. The C#
adapter strictly validates that contract, renders configured project icons, and
relays typed action requests back to TypeScript.

A configured project root is the Codex task working directory. Optional
repository roots extend task association to nested or otherwise related Git
working trees and all linked worktrees discovered from their Git metadata. The
configuration names repository working trees rather than `.git` internals, and
this association remains owned by the Codex state-source boundary.
The device Home behavior and the close effect are owned by the Logitech runtime.
The issue 4 one-project path completed its bounded physical-device smoke test.
The superseded TypeScript startup-snapshot plugin was removed after that
validation, leaving the live adapter as the single package path. The issue 5
bounded physical-device demonstration covered simultaneous project tiles in
configured order, project/task/Back navigation, live rename, reorder and removal,
and a worker count from a linked Codex worktree without restarting Options+.
Custom project icons and multi-page project navigation remain automated-only
evidence for issue 5.

TypeScript accepts only the normalized `open-project-overview`,
`open-project-page`, `open-task-view`, `open-task-page`, and `open-codex-task`
requests. Project and page routes must match the current configuration, and the
task action must match a current task in the selected project. Tasks are opened by the existing
shell-free, validated Codex deep-link adapter. Unknown action types and unknown
JSON members are rejected. Task labels use normalized task names or an opaque
identifier fallback, never raw prompt or transcript content. Attention
aggregation and agent-customized layouts remain later roadmap slices.

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
view; Back returns to the project overview and the device's normal Home behavior
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
confirmed healthy state.

Agent-requested layout changes are optional declarative inputs. They pass through
schema and policy validation and may select only allowlisted presentation choices
and semantic actions. The default selected-project layout remains one button per
task, and no handoff payload may execute an arbitrary command.

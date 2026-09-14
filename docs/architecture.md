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

## Current tracer bullet

The TypeScript Logitech plugin reads active Codex Desktop tasks through an
isolated Codex adapter, assigns a startup snapshot to nine stable LCD-key actions,
and opens a selected task through `codex://threads/<thread-id>`. Live image and
label updates require either a richer device adapter or future Node SDK support.

The tracer bullet has been observed starting and working end to end on macOS with
the physical keypad. That establishes the basic plugin, task-selection, and deep-
link path; it does not establish live display updates.

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

The live Logitech adapter is a thin C# dynamic-folder plugin. The repository's
pinned Node SDK registers command and adjustment actions before connecting, but
does not expose the dynamic-folder layout and image invalidation needed for live
LCD views. The C# SDK documents that capability. This split keeps Logitech-specific
rendering out of the product core while retaining the proven TypeScript state work.

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

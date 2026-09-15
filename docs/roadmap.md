# Three-level Codex control-surface roadmap

Tracking issue: [#3](https://github.com/blackbuild/codex-keypad/issues/3)

## Goal

Deliver a live, project-aware Codex control surface without coupling Codex state
parsing, agent handoff, or product vocabulary to Logitech hardware.

The product presents three levels:

1. A global Codex entry tile on a normal keypad profile.
2. A project overview with one tile per configured project.
3. A selected-project task view that defaults to one tile per task.

The entry tile summarizes all projects. Project tiles show identity and active-
worker count. Task tiles show individual state and open the exact Codex task.

## Implementation slices

| Order | Slice | Depends on | Independently verifiable outcome |
|---|---|---|---|
| 1 | [#4 Enter Codex and open one task](https://github.com/blackbuild/codex-keypad/issues/4) | None | One live Level 0 → Level 1 → Level 2 path works on the keypad. |
| 2 | [#5 Populate the project overview](https://github.com/blackbuild/codex-keypad/issues/5) | #4 | Multiple projects show icons and active-worker counts. |
| 3 | [#6 Populate the default task view](https://github.com/blackbuild/codex-keypad/issues/6) | #5 | A selected project shows one live button per task by default. |
| 4 | [#7 Aggregate attention](https://github.com/blackbuild/codex-keypad/issues/7) | #5, #6 | Task, project, and global states compose deterministically. |
| 5 | [#8 Add review-aware attention](https://github.com/blackbuild/codex-keypad/issues/8) | #7 | External review state reaches the project and global views through an adapter. |
| 6 | [#9 Apply agent-requested layouts](https://github.com/blackbuild/codex-keypad/issues/9) | #6, #7 | Validated declarative requests customize the layout without arbitrary execution. |

Each slice crosses its required state-source, normalized-contract, device-rendering,
semantic-action, automated-test, and physical-device-validation boundaries. A
slice should not be split into separate backend and UI issues unless implementation
evidence proves that a preparatory refactoring must stand alone.

## Dependency shape

```text
#4 three-level path
└── #5 project overview
    ├── #6 default task view
    │   └── #9 agent-requested layouts
    └── #7 attention aggregation
        ├── #8 review-aware attention
        └── #9 agent-requested layouts
```

## Default and customization boundary

Without configuration or agent input, Level 2 presents one button per task with
deterministic ordering and pagination. Agent input may request allowed ordering,
visibility, icons, or semantic actions, but cannot replace the normalized state,
grant authority, introduce executable commands, or make one filesystem layout a
product prerequisite.

## Validation strategy

Every slice requires automated verification of its normalized contracts and
adapter behavior. Changes affecting the control surface also require a bounded
physical-device demonstration when the keypad is available. A temporarily
unavailable device may defer that external acceptance condition, but it does not
turn a simulated result into hardware evidence.

The original startup-snapshot tracer established the basic device and deep-link
path. Issue #4 replaced it with the physically validated live adapter, which is
now the sole package path and baseline for later slices.

## Non-goals

- Requiring users to call coordinator tasks Hives.
- Requiring the repository/agent split-directory convention.
- Sending arbitrary commands from an agent to a device plugin.
- Coupling the Logitech adapter directly to Codex persistence or GitHub payloads.
- Treating project memory or handoff data as project authority.

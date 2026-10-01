# Default visual system

Schema version 11 carries the normalized presentation from TypeScript to the
Logitech adapter. TypeScript owns parsing, runtime/workflow separation, attention
precedence, and aggregation. The adapter renders the supplied icon, cues, rails,
and semantic actions without deriving policy.

## Runtime, workflow, and attention

Each task retains Codex's observed runtime status and a separately parsed
workflow state. Runtime remains the large task icon and background. The configured
workflow declaration appears as a compact text badge alongside the runtime badge.
The stable task ID continues to identify and open the task; compact labels never
participate in navigation.

The closed workflow vocabulary is:

- `unspecified`
- `waiting-for-ci`
- `waiting-for-review`
- `changes-requested`
- `waiting-for-input`
- `waiting-for-approval`
- `blocked`
- `handoff-failed`
- `done`

`waiting-for-ci`, `done`, and `unspecified` are informational and do not add
operator attention. `waiting-for-review`, `changes-requested`,
`waiting-for-input`, `waiting-for-approval`, `blocked`, and `handoff-failed` do.
`done` means orchestration declared the work accepted and the worker may be
archived later; the plugin does not archive workers.

## Attention precedence

Concurrent attention is counted and ordered with this fixed precedence:

1. failed runtime
2. handoff-failed workflow
3. blocked workflow
4. waiting-for-approval
5. changes-requested
6. waiting-for-review
7. waiting-for-input
8. interrupted runtime
9. unavailable
10. stale
11. working runtime
12. idle/completed runtime

Only the first three distinct conditions appear in the bounded attention summary;
additional conditions are counted. Idle is omitted whenever a non-idle condition
exists. Workflow information never replaces the runtime field or runtime icon.
Project and global tiles aggregate both dimensions. Worker rails retain concurrent
conditions with attention and diagnostics on the left, and working/idle on the
right. The badge letters and distinct shapes provide cues alongside color.

| State | Icon/tone cue | Badge |
|---|---|---|
| `idle` / completed | Check | `OK` |
| `working` | Double chevron | `>` |
| `waiting-for-input` | Speech bubble | `I` |
| `waiting-for-approval` | Hourglass | `A` |
| `waiting-for-review` | Eye cue | `R` |
| `changes-requested` | Change cue | `C` |
| `blocked` | Block cue | `B` |
| `handoff-failed` | Cross | `H` |
| `interrupted` | Pause | `X` |
| `failed` | Cross | `!` |
| `unavailable` | Question mark | `?` |
| `stale` | Clock | `~` |

Project tiles retain neutral bodies, tapered status tabs, configured/default
icons, and bounded worker rails. The global entry retains its packaged OpenAI
mark or built-in terminal fallback. Coordinator tiles retain the configured
project icon or Hive fallback. The native label below the bitmap is separate
from the bitmap; attention and workflow badges are drawn only once inside it.

## Safe title rules

Workflow rules match literal title markers and map only to the closed vocabulary.
If multiple rules match, the first rule in the effective configuration wins. The
compact-label expressions use a validated bounded subset: no groups, alternation,
backreferences, or unbounded wildcard operators; task titles are bounded before
matching. An invalid configuration fails closed, an unmatched title becomes
`unspecified`, and an unmatched compact label uses a bounded title fallback.
Prompt and transcript content are never consulted.

## Device acceptance

Automated tests verify normalized presentation and rendering. They do not count
as physical-device acceptance. The exact MX Keypad acceptance checklist is in
[physical-device-validation.md](physical-device-validation.md).

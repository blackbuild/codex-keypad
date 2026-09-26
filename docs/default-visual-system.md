# Default visual system

Schema version 10 carries a complete normalized visual presentation from the
TypeScript control-surface core to the Logitech adapter. The adapter draws that
presentation; it does not infer attention, precedence, aggregation, icons, or
colors. These defaults apply without an agent-authored layout.

## Attention legend

Every attention-bearing tile has a native Logitech display label below its
bitmap and a primary background. The bitmap does not repeat the display label.
Global, project, and coordinator
tiles additionally place status-sorted worker indicators down their sides:
attention-required and diagnostic states on the left, working and idle states
on the right. Working groups anchor toward the top of the right rail while idle
groups anchor toward its bottom, so the common states remain spatially distinct
when brightness makes their colors harder to separate. Only the coordinator
retains its compact upper-right status badge.
The contrast ratios below use the WCAG
relative-luminance formula; they are design-time sRGB figures, not a substitute
for checking the physical LCD.

| Normalized state | Worker icon | Label cue | Coordinator badge | Background | Indicator | White-text contrast |
|---|---|---|---:|---:|---:|---:|
| `idle` (including completed tasks) | Check | Idle / Completed | `OK` | `#1F2937` | `#C2C7D0` | 14.68:1 |
| `working` | Double chevron | Working | `>` | `#075985` | `#38BDF8` | 7.56:1 |
| `waiting-for-input` | Speech bubble | Waiting for input | `I` | `#1E3A8A` | `#60A5FA` | 10.36:1 |
| `waiting-for-approval` | Hourglass | Waiting for approval | `A` | `#713F12` | `#FACC15` | 8.67:1 |
| `waiting-for-review` | Eye cue | Waiting for review | `R` | `#134E4A` | `#5EEAD4` | 9.48:1 |
| `interrupted` | Pause | Interrupted | `X` | `#4C1D95` | `#A78BFA` | 10.95:1 |
| `failed` | Cross | Failed | `!` | `#7F1D1D` | `#F87171` | 10.02:1 |
| `unavailable` | Question mark | Unavailable / State unavailable | `?` | `#3F3F46` | `#D4D4D8` | 10.44:1 |
| `stale` | Clock | Stale / Count stale | `~` | `#57534E` | `#FDBA74` | 7.63:1 |

An unrecognized persisted task status is normalized to `unavailable`; raw
provider status text is never published. A source read failure is also
`unavailable`. Worker evidence older than 24 hours, with no current evidence, is
`stale`. Current workers accompanied by stale evidence remain a lower-bound
count and add `stale` as a concurrent condition. Implausibly future-dated data
adds `unavailable`, including when a valid current lower-bound count is retained.

Review attention is produced by a separate authenticated review-provider source.
Only a fresh, validated result may add `waiting-for-review`; a fresh result with
no requested reviews adds no review condition. An unauthenticated source, missing
provider configuration, malformed response, request failure, or stale cached
response can never confirm review. Configured provider failures appear as
`unavailable` or `stale`, with the same diagnostic precedence used elsewhere.
The source currently counts open, non-draft GitHub pull requests that have at
least one requested reviewer or team, checks at most 1,000 pull requests, and
revalidates at least every 60 seconds. Its token and raw API records stay inside
the provider adapter; the normalized project state contains only review
availability and a bounded count, and the published control-surface contract
contains only attention and presentation.

Review attention composes alongside task states. Failure takes precedence over
approval, approval over review, review over input, and input over interrupted,
unavailable, stale, working, and idle. Concurrent task conditions remain in the
bounded summary and worker rails. Project and global-entry tiles show the review
accent and an `R` cue when review is among their normalized indicators. Selecting
the project tile uses its existing allowlisted `open-task-view` action; review
does not introduce provider navigation or a URL action.

The current Codex SQLite source exposes in-progress, completed, failed, and
interrupted task states. Waiting-for-input and waiting-for-approval already have
stable normalized and rendered tokens, but they appear only when a state source
can supply those conditions; the SQLite adapter does not infer them from prompts,
transcripts, or provider-private details.

These are runtime/availability states, not workflow states. PR ready, merge
ready, review requested, changes requested, and domain-specific question labels
must come from a separate provider or validated configuration. They do not
replace the worker's runtime-state icon.

## Composition and precedence

Task state reduces to project attention from normalized task and project data;
all configured projects reduce again to the global Codex entry. Repeated states
are counted. Distinct states use this fixed precedence:

1. failed
2. waiting for approval
3. waiting for review
4. waiting for input
5. interrupted
6. unavailable
7. stale
8. working
9. idle

The first state supplies the background. Worker rails retain all available
normalized worker groups in
precedence order. A configured coordinator is represented by the Hive itself and
is not repeated as a rail indicator. Counts of one through three are individual eight-pixel blobs;
groups of four or more use a solid vertical capsule in the state's color. The capsule
deliberately communicates "many" instead of an exact count, because numeric glyphs
are not reliably legible at this display size. When several groups would exceed a
rail's height, the largest remaining blob groups collapse to the same bounded capsule
treatment until the layout fits. Confirmed idle is used only when no non-idle or
diagnostic condition is present.

## Icon vocabulary and fallbacks

| Level | Built-in icon | Semantic action |
|---|---|---|
| Global Codex entry | Packaged transparent white OpenAI knot mark; terminal/code-window fallback | Enter the native folder at its retained internal level |
| Project | Three-cell Hive | Open that project's task view |
| Task | Normalized runtime-state symbol | Open that exact current task |
| Coordinator task | Project PNG or three-cell Hive; project-name label | Open that exact coordinator task |
| Up | Large upward arrow | Return to the project overview |

A packaged transparent white OpenAI knot mark identifies the global entry. It is
lowered slightly to clear the native Options+ folder handle and sits on a neutral
dark background; root-level state remains visible in the worker indicators. If that package asset is
missing or unreadable, the entry falls back to the built-in terminal icon. A
configured project PNG may replace the baseline imagery on its project and
coordinator tiles. If the path is absent, unreadable, oversized, or not a
decodable PNG, the matching built-in icon is still rendered. The native
display label below the bitmap, one-pixel frame, and worker rails remain visible
with either image path.

Up uses the navigation background `#111827` with a white arrow (17.74:1). It has
no attention summary or worker indicators. No visual field carries a command; the
only accepted actions are the closed semantic navigation actions shown above.
If no fresh validated contract exists at all, the device adapter cannot receive a
core-owned presentation; its sole local safety fallback is a `?` image on the
unavailable background while the native label remains `Codex`. It never presents
the last healthy image as fresh.

## Device constraints

The Logitech adapter receives compact bitmap dimensions from the SDK. The global
entry uses an unframed neutral field with worker indicators directly on its edges.
Project tiles use neutral bodies with the same three-cell Hive symbol as their
coordinator tile and a centered, top-wide tab that tapers inward toward the body
in their single primary status color. The idle tab uses the brighter idle indicator
accent instead of the darker completed-task background. Coordinator tiles retain their colored backgrounds. Both draw a
two-pixel frame around their dark side gutters. Worker blobs and compressed solid
capsules sit in those gutters and remain inside the bitmap edges. This gives the colored/icon
field a narrower framed-panel appearance while separating indicators from busy
custom artwork. A coordinator's right lane begins below its retained badge.
The device adapter draws the normalized icon role with simple vector primitives,
so the defaults do not depend on optional font symbols or external assets. The
SDK renders the display label separately below the bitmap. Task labels contain
only an 18-character compact task-title cue; runtime state is carried by the
large state-specific icon and background. Project labels
contain only their configured display name; the global label is simply `Codex`.
Worker counts and diagnostic cues are carried by the side rails. Actual cropping, native-label
legibility, color separation, and brightness behavior still require the physical
checks in [physical-device-validation.md](physical-device-validation.md).

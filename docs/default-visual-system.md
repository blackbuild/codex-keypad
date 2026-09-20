# Default visual system

Schema version 8 carries a complete normalized visual presentation from the
TypeScript control-surface core to the Logitech adapter. The adapter draws that
presentation; it does not infer attention, precedence, aggregation, icons, or
colors. These defaults apply without an agent-authored layout.

## Attention legend

Every attention-bearing tile has a native Logitech display label below its
bitmap, an ASCII badge inside the bitmap, a primary background, and one top-edge
segment per visible condition. The bitmap does not repeat the display label.
White fallback glyphs and badges are drawn on the primary background even when a
custom PNG is present. The contrast ratios below use the WCAG
relative-luminance formula; they are design-time sRGB figures, not a substitute
for checking the physical LCD.

| Normalized state | Label cue | Badge | Background | Segment | White-text contrast |
|---|---|---:|---:|---:|---:|
| `idle` (including completed tasks) | Idle / Completed | `OK` | `#1F2937` | `#9CA3AF` | 14.68:1 |
| `working` | Working | `>` | `#075985` | `#38BDF8` | 7.56:1 |
| `waiting-for-input` | Waiting for input | `I` | `#1E3A8A` | `#60A5FA` | 10.36:1 |
| `waiting-for-approval` | Waiting for approval | `A` | `#713F12` | `#FACC15` | 8.67:1 |
| `interrupted` | Interrupted | `X` | `#4C1D95` | `#A78BFA` | 10.95:1 |
| `failed` | Failed | `!` | `#7F1D1D` | `#F87171` | 10.02:1 |
| `unavailable` | Unavailable / State unavailable | `?` | `#3F3F46` | `#D4D4D8` | 10.44:1 |
| `stale` | Stale / Count stale | `~` | `#57534E` | `#FDBA74` | 7.63:1 |

An unrecognized persisted task status is normalized to `unavailable`; raw
provider status text is never published. A source read failure is also
`unavailable`. Worker evidence older than 24 hours, with no current evidence, is
`stale`. Current workers accompanied by stale evidence remain a lower-bound
count and add `stale` as a concurrent condition. Implausibly future-dated data
adds `unavailable`, including when a valid current lower-bound count is retained.

The current Codex SQLite source exposes in-progress, completed, failed, and
interrupted task states. Waiting-for-input and waiting-for-approval already have
stable normalized and rendered tokens, but they appear only when a state source
can supply those conditions; the SQLite adapter does not infer them from prompts,
transcripts, or provider-private details.

## Composition and precedence

Task state reduces to project attention from normalized task and project data;
all configured projects reduce again to the global Codex entry. Repeated states
are counted. Distinct states use this fixed precedence:

1. failed
2. waiting for approval
3. waiting for input
4. interrupted
5. unavailable
6. stale
7. working
8. idle

The first state supplies the background and leading label. At most three
distinct conditions are visible as ordered top-edge segments and badge glyphs.
Further distinct conditions are represented by a `+N` badge suffix and a
`+N state(s)` label suffix. This keeps composition bounded while making omitted
lower-priority conditions explicit. Confirmed idle is used only when no
non-idle or diagnostic condition is present.

## Icon vocabulary and fallbacks

| Level | Built-in icon | Semantic action |
|---|---|---|
| Global Codex entry | Packaged OpenAI knot mark; terminal/code-window fallback | Open the project overview |
| Project | Folder | Open that project's task view |
| Task | Document | Open that exact current task |
| Coordinator task | Three-cell Hive | Open that exact coordinator task |
| Up | Large upward arrow | Return to the project overview |

A packaged OpenAI knot mark identifies the global entry. If that package asset is
missing or unreadable, the entry falls back to the built-in terminal icon. A
configured project PNG may replace the baseline imagery on its project tile
and coordinator task tile. If the path is absent, unreadable, oversized, or not
a decodable PNG, the matching built-in icon is still rendered. The native
display label below the bitmap, badge, and segmented attention edge remain
visible with either image path.

Up uses the navigation background `#111827` with a white arrow (17.74:1). It has
no attention summary or state segments. No visual field carries a command; the
only accepted actions are the closed semantic navigation actions shown above.
If no fresh validated contract exists at all, the device adapter cannot receive a
core-owned presentation; its sole local safety fallback is `? Codex unavailable`
on the unavailable background. It never presents the last healthy image as fresh.

## Device constraints

The Logitech adapter receives compact bitmap dimensions from the SDK. It uses
the full bitmap for baseline/custom imagery, reserves four pixels at the top for
at most three state segments, and places a padded status badge below that strip.
The device adapter draws the normalized icon role with simple vector primitives,
so the defaults do not depend on optional font symbols or external assets. The
SDK renders the display label separately below the bitmap. Task-title cues
are bounded to 18 characters before their full normalized state suffix; project
and global labels retain the contract's general bound. Actual cropping, native-label
legibility, color separation, and brightness behavior still require the physical
checks in [physical-device-validation.md](physical-device-validation.md).

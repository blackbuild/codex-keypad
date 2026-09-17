# Physical-device validation

Issue 7 requires a bounded MX Keypad demonstration after installing the packaged
plugin. Automated builds and simulated state are prerequisites, not hardware
acceptance. Record the package checksum, Options+ version, device/firmware, LCD
brightness, and pass/fail for each check; do not record private task content.

1. **Task states:** present one task tile for completed, working, waiting for
   input, waiting for approval, interrupted, failed, and unavailable source
   states. Confirm the label, badge, background, segment, and `T` fallback match
   the legend and update without restarting Options+.
2. **Project aggregation:** place at least two different task states in one
   project. Confirm the documented primary state wins, each of up to three
   conditions has an ordered segment/badge cue, the label reports concurrent
   states, and pressing the tile opens that project's task view.
3. **Global aggregation:** distribute at least three different conditions across
   two configured projects. Confirm the Codex entry composes them in the same
   order and opens the project overview.
4. **Bounded overflow:** expose at least four distinct states. Confirm only three
   segments/glyphs are drawn, the badge and label show the correct `+N`, and no
   text or segment is clipped beyond recognition.
5. **Icons and fallbacks:** check the `C`, `P`, `T`, and `<` baselines with no
   custom icon; then check one valid project PNG and one missing or invalid PNG.
   The invalid image must fall back to `P` or `T`, not to a blank tile.
6. **Stale and unavailable:** present stale-only worker evidence, mixed current
   plus stale evidence, a source read failure, and an unknown persisted task
   status. Confirm `~`/Stale is distinct from `?`/Unavailable and neither looks
   idle or healthy.
7. **Legibility:** at the normal operating brightness, read every label/badge at
   arm's length, including a busy custom icon. Confirm white text remains on the
   solid lower panel and the three segment colors are distinguishable. Repeat at
   the lowest brightness the maintainer considers supported.
8. **Navigation safety:** press every attention-bearing entry, project, and task
   tile. Confirm it reaches only the corresponding overview, project, or exact
   current task; a removed task is inert and no executable command is accepted.
9. **Adapter freshness fallback:** stop or invalidate the sidecar state and wait
   beyond the two-second freshness window. Confirm the global tile changes to the
   explicit `? Codex unavailable` fallback rather than retaining healthy state.

Hardware acceptance is complete only when the maintainer records all nine checks
as passing on the physical device.

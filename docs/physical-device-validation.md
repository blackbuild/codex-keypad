# Physical-device validation

Issue 7 requires a bounded MX Keypad demonstration after installing the packaged
plugin. Automated builds and simulated state are prerequisites, not hardware
acceptance. Record the package checksum, Options+ version, device/firmware, LCD
brightness, and pass/fail for each check; do not record private task content.
If a state cannot be produced safely and reliably by the current live source,
record that limitation and the available automated coverage instead of editing the
real Codex database or claiming physical coverage from a synthetic renderer test.

1. **Task states:** present one task tile for completed, working, waiting for
   input, waiting for approval, interrupted, failed, and unavailable source
   states. Confirm the compact task-identity label remains free of appended status
   text while the background and large state-specific worker icon match
   the legend and update without restarting Options+.
2. **Project aggregation:** place at least two different task states in one
   project. Confirm the documented primary state wins, conditions have ordered
   split side rails, the bitmap carries the bounded
   worker count while the native label remains only the configured project name,
   and pressing the tile opens that project's task view.
3. **Global aggregation:** distribute at least three different conditions across
   two configured projects. Confirm the Codex entry composes them in the same
   order and opens the project overview.
4. **Bounded overflow:** expose at least four distinct states and at least four
   workers in one state. Confirm worker groups remain status-sorted, counts of four
   through nine become a colored digit, counts of ten or more become a colored `+`,
   and no digit, `+`, or blob is clipped beyond recognition.
5. **Icons and fallbacks:** check the packaged OpenAI knot mark on the global entry and
   the terminal fallback when that asset is unavailable. With no custom project
   icon, check the connected-workspace, state-specific worker, Hive coordinator, and large
   Up-arrow baselines; confirm the coordinator label is the project display name; then
   check one valid project PNG and one missing or invalid PNG. An invalid image
   must fall back to the appropriate built-in icon, not to a blank tile.
6. **Stale and unavailable:** present stale-only worker evidence, mixed current
   plus stale evidence, a source read failure, and an unknown persisted task
   status. Confirm `~`/Stale is distinct from `?`/Unavailable and neither looks
   idle or healthy.
7. **Legibility:** at the normal operating brightness, read every native display
   label and side rails at arm's length, including a busy custom icon. Confirm
   the label appears only once below the bitmap, compact task titles remain
   recognizable, the Hive badge does not crowd its right rail, and indicator colors
   are distinguishable. Repeat at the lowest brightness the maintainer considers
   supported.
8. **Navigation safety:** press every attention-bearing entry, project, and task
   tile. Confirm it reaches only the corresponding overview, project, or exact
   current task; a removed task is inert and no executable command is accepted.
9. **Adapter freshness fallback:** stop or invalidate the sidecar state and wait
   beyond the two-second freshness window. Confirm the global tile changes to the
   explicit `?` image with the `Codex` native label rather than retaining healthy state.

Hardware acceptance is complete only when the maintainer records all nine checks
as passing on the physical device.

## Validation record: 0.2.18–0.2.20

Test started on 2026-09-25.

| Context | Value |
|---|---|
| Initial package | `CodexKeypad_0_2_18.lplug4` (`9a8b470bef81fa5bb473f7b4a8478ef747d3cc6d1954ec10760df9ec01945b10`) |
| Intermediate package | `CodexKeypad_0_2_19.lplug4` (`d465abb37d527166fd96d67673605933094f23282cd6560fedd07465cb774a13`) |
| Final package | `CodexKeypad_0_2_20.lplug4` (`dd559d1e814232e805cfe008de2b8e409b33a07db9bcca3ead6649d4a84a04c2`) |
| Logi Options+ | 2.7.970334 |
| Firmware | 166.0.17 |
| Normal display brightness | 50% |

| Check | Result | Notes |
|---:|---|---|
| 1. Task states | Pass for available states | Working → completed updated live without restarting Options+; double-chevron/checkmark icons, backgrounds, single native title, and removal of redundant status text/icon confirmed. Interrupted showed the purple background and large pause symbol after stopping a running task. The read-only history audit found failed states only on archived tasks. Waiting-for-input and waiting-for-approval are not emitted by the current SQLite source. Failed, waiting, and normalized-unavailable task imagery remains covered by SDK-backed bitmap and contract tests; no production database was modified to fabricate physical coverage. |
| 2. Project aggregation | Pass | With working and completed workers in one project, the configured project label, neutral body, connected-workspace icon, blue tapered primary-state tab, ordered right-side worker indicators, coordinator exclusion, and navigation to the correct task view were confirmed. |
| 3. Global aggregation | Fix pending physical retest | On 0.2.18, the top-level Codex key retained an older image until a profile switch. Version 0.2.19's plugin-wide invalidation refreshed one working transition, but a subsequent three-to-four-worker transition remained stale, so the fix was not reliable. SDK inspection showed that the root is registered under the dynamic-folder `Name`, while inner tiles use `CommandName`. Version 0.2.20 targets the folder name directly and requires physical retest. |
| 4. Bounded overflow | Blocked by root refresh retest | The live contract reported four working workers and eight idle workers, but the 0.2.19 root remained on three working blobs. Digit and `+` overflow checks resume after the 0.2.20 root refresh retest. |
| 5. Icons and fallbacks | Pending | |
| 6. Stale and unavailable | Pending | |
| 7. Legibility | Pending | 50% normal brightness recorded; lowest supported brightness still pending. |
| 8. Navigation safety | Pending | |
| 9. Adapter freshness fallback | Pending | |

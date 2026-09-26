# Physical-device validation

Issues 7 and 8 require bounded MX Keypad demonstrations after installing the packaged
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
   order. Entering the native dynamic folder may restore its retained project or
   task level; confirm the explicit Up tile returns to the project overview.
4. **Bounded overflow:** expose at least four distinct states and at least four
   workers in one state. Confirm worker groups remain status-sorted, counts of one
   through three remain separate blobs, groups of four or more become a solid colored
   capsule, and no blob or capsule is clipped beyond recognition.
5. **Icons and fallbacks:** check the packaged OpenAI knot mark on the global entry and
   the terminal fallback when that asset is unavailable. With no custom project
   icon, check the shared three-cell project/Hive symbol, state-specific worker, Hive coordinator, and large
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
8. **Navigation safety:** enter the dynamic folder, then press every attention-bearing
   project and task tile and the explicit Up tile. Confirm each reaches only the
   corresponding project view, exact current task, or project overview. Re-entering
   the native dynamic folder may restore its retained internal level. A removed task
   is inert and no executable command is accepted.
9. **Adapter freshness fallback:** stop or invalidate the sidecar state and wait
   beyond the two-second freshness window. Confirm the global tile changes to the
   explicit `?` image with the `Codex` native label rather than retaining healthy state.

## Issue 8 review-aware demonstration

These additional checks are required for physical acceptance of review-aware
attention. Use a test repository and a GitHub token supplied only to the running
Options+ process. Do not record the token, pull-request titles, reviewer names, or
raw provider responses.

1. **Review appearance:** create one open, non-draft pull request with a requested
   reviewer. Confirm its project's tile and the global Codex entry show the teal
   review cue and `R` mark while their native labels remain the project name and
   `Codex`.
2. **Aggregation and precedence:** in the same project, produce concurrent task
   input, approval, working, failure, and review conditions. Confirm failure is
   primary, approval outranks review, review outranks input, and review remains
   visible among the bounded indicators. Repeat across two projects and confirm
   the same composition at the global entry.
3. **Allowlisted navigation:** press the review-bearing project tile. Confirm it
   opens only that project's task view. Verify no provider URL, pull-request URL,
   reviewer identity, or command is opened or sent to the device adapter.
4. **Live refresh:** add a review request, then remove it. Confirm the review cue
   appears and clears after the provider refresh interval without restarting
   Options+.
5. **Provider safety:** repeat without a token, with an invalid token, with a
   simulated malformed response, and after a successful result followed by a
   failed refresh. Confirm these cases show unavailable or stale diagnostics and
   never retain confirmed review attention. Restore authenticated access and
   confirm a successful refresh replaces the diagnostic state.

Hardware acceptance is complete only when the maintainer records the original
nine issue 7 checks and all five issue 8 checks as passing on the physical device.

## Validation record: 0.2.18–0.2.22

Test started on 2026-09-25.

| Context | Value |
|---|---|
| Initial package | `CodexKeypad_0_2_18.lplug4` (`9a8b470bef81fa5bb473f7b4a8478ef747d3cc6d1954ec10760df9ec01945b10`) |
| Intermediate package | `CodexKeypad_0_2_19.lplug4` (`d465abb37d527166fd96d67673605933094f23282cd6560fedd07465cb774a13`) |
| Intermediate package | `CodexKeypad_0_2_20.lplug4` (`dd559d1e814232e805cfe008de2b8e409b33a07db9bcca3ead6649d4a84a04c2`) |
| Intermediate package | `CodexKeypad_0_2_21.lplug4` (`6df8e9cbad8eb9ff877de01d5cf14d339f65f392dac398d1230eecdc7b3c9177`) |
| Final package | `CodexKeypad_0_2_22.lplug4` (`c26987ae97fe2c9d1d7c2a92fff1d655c9467ed3eff77b7e097d6470e18a2947`) |
| Logi Options+ | 2.7.970334 |
| Firmware | 166.0.17 |
| Normal display brightness | 50% |

| Check | Result | Notes |
|---:|---|---|
| 1. Task states | Pass for available states | Working → completed updated live without restarting Options+; double-chevron/checkmark icons, backgrounds, single native title, and removal of redundant status text/icon confirmed. Interrupted showed the purple background and large pause symbol after stopping a running task. The read-only history audit found failed states only on archived tasks. Waiting-for-input and waiting-for-approval are not emitted by the current SQLite source. Failed, waiting, and normalized-unavailable task imagery remains covered by SDK-backed bitmap and contract tests; no production database was modified to fabricate physical coverage. |
| 2. Project aggregation | Pass | With working and completed workers in one project, the configured project label, neutral body, connected-workspace icon, blue tapered primary-state tab, ordered right-side worker indicators, coordinator exclusion, and navigation to the correct task view were confirmed. |
| 3. Global aggregation | Pass | On 0.2.18, the top-level Codex key retained an older image until a profile switch. Version 0.2.19's plugin-wide invalidation refreshed one transition but was unreliable, and version 0.2.20 targeted the folder implementation name instead of its assigned action. Version 0.2.21 invalidates the persisted root assignment (`#DynamicFolder` plus the folder `Name`). After installation the initial `?` changed directly, and the visible root then updated live from two to four working workers during a 20-second task and back through three to two as workers completed, without entering the folder or switching profiles. |
| 4. Bounded overflow | Pass | Live root counts of two, three, and four updated correctly. An idle group of at least ten rendered as a gray `+` on 0.2.21, but the glyph was not legible at 50% brightness. Version 0.2.22 replaced textual overflow with a count-independent solid capsule for groups of four or more. On the physical root key, blue working dots at the top and the gray idle capsule at the bottom were clear, separated by a distinct gap, and fully inside the key edges. |
| 5. Icons and fallbacks | Pass | The transparent white Codex knot, shared three-cell project/Hive symbol, Hive coordinator with the project-name label, large Up arrow, state-specific worker symbols, and configured Codex Keypad custom PNG were all recognizable on the physical device. On 0.2.22, an uncustomized Baseline project and its coordinator used the same Hive symbol while tab, background, label, and position kept their levels clear. The brighter idle tab was clearly visible at 50% without a white outline. Making the configured custom PNG unreadable changed its project tile to the built-in symbol rather than a blank image, and restoration brought the custom image back live. Making the installed Codex mark unreadable and forcing a redraw showed the built-in terminal/code-window fallback; restoring the asset and redrawing restored the transparent knot. |
| 6. Stale and unavailable | Pass for safely producible state | Terminating the live-state sidecar produced the explicit gray `?` unavailable image rather than idle or retained healthy state. A live stale worker requires an otherwise-active task whose update timestamp is more than 24 hours old, while an unknown persisted status requires changing Codex's database; neither was fabricated. Automated source, aggregation, contract, and bitmap tests cover stale-only, mixed current-plus-stale, future/unavailable evidence, and unknown-status normalization without modifying production data. |
| 7. Legibility | Pass | At 50% brightness and arm's length, native labels appeared once and were readable, compact task titles remained recognizable, the Hive badge did not crowd its right rail, and status colors were distinguishable. Version 0.2.22 anchors working indicators at the top and idle indicators at the bottom of the right rail, brightens idle gray, and uses non-textual overflow capsules. At 1% brightness, the blue top group and gray bottom capsule remained distinguishable by position, the brighter gray project tab was recognizable, and Hive symbols and native labels remained usable. |
| 8. Navigation safety | Pass | After leaving the folder from a task view and waiting 30 seconds, pressing the top-level Codex knot restored that retained task view. This explains the previously intermittent-looking behavior and is accepted: entering the native dynamic folder does not itself emit the semantic overview action, while the explicit Up tile returns to the project overview. Project tiles opened their corresponding task views, and a recognized task tile opened that exact task in Codex Desktop. The 250 ms live refresh makes a removed tile impractical to press reliably; automated navigation tests verify that a removed task is rejected, while contract and inbox tests accept only the closed semantic-action schema and reject extra command fields. |
| 9. Adapter freshness fallback | Pass | With the top-level key visible, the verified Codex Keypad sidecar was terminated. After the two-second freshness window the healthy knot presentation changed to the gray `?` image with the `Codex` native label. A profile switch did not restart the terminated sidecar; reinstalling 0.2.21 restored the sidecar, normal knot, and live indicators. |

### 0.2.22 visual decisions

- Use a brighter idle gray (`#C2C7D0`) without adding a white tab outline.
- Reuse the three-cell Hive symbol for both default project and coordinator tiles;
  their tab, background, label, and position distinguish the levels.
- Keep running indicators toward the top and completed indicators toward the
  bottom of the right rail, with a deliberate gap between them.
- Render one to three workers as blobs and four or more as a solid capsule.

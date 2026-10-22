# T-0037 handoff (grok)

Status: DONE, APPROVED AND MERGED. Matthew requested it directly in chat, so it is approved at plan and completion (rule 16,
direct-request clause, his 01:52 PT words). Events: 01-55 approve-plan + claim, 02-03 complete + approve (all for: matthew).
Branch `grok/system-properties`, worktree `C:\dev\boreal-grok-sysprops` (from main c4407d9). Built on the box in
/workspace/sysprops/repo, applied here with `git am` (patches stripped of CR: this repo's index is LF, autocrlf=true).

## Merge with T-0035 (02:02 PT)
- main (91281b7 T-0035, e528e1a T-0038) merged into the branch as b841168. One add/add conflict, src/config/systemProperties.ts: kept every group (autoFocus first, targetGlow after sensesHalo, alphabetical), removed both from PENDING_GROUPS (needsThoughts stays for T-0036), added PROPERTY_META for autoFocus (readers core/focusLock, core/bindings, render/buildScene, main) and targetGlow (render/targetGlow) with units + sources, added core/focusLock + render/targetGlow to SYSTEM_MAP.interaction modules, updated the camera / controls / interaction still-in-code notes. npm run system-map regenerated docs/system-map.md. npm test 373: 361 pass, 0 fail, 12 todo; tsc clean.
- Flaky, unrelated: tests/trace.test.ts 'trace off ... f allocates when off' (heap growth < 4 MB) failed once in the full run before the T-0035 merge and passes alone and in the next full run.
- Noticed: main.ts:302 controls help text says 'within ${FOCUS.radius} m' (it states the 4.5 m); Matthew said 'i dont need the exact distance told' - left for the T-0035 owner.

## Doing now (before merge)
01:50 PT: handoff with the evidence table. Next: wait for approve-plan; then claim + complete event.

## What was built (commits, oldest first)
- 6c2c522 task, propose + approve-plan request (comment) events, this handoff (board copy on main as f0ac0ce).
- 8210435 `src/config/systemProperties.ts`: SYSTEM_PROPERTIES (12 groups), PROPERTY_META (units + source + readers per figure),
  SYSTEM_MAP (22 systems: modules, groups, dependsOn, URL flags, linked tables, still-in-code list), PENDING_GROUPS;
  `src/config/live.ts` (widened mutable copy for objects that settings change at runtime).
- 583480e camera (render/math) · e624e83 movement + jump (core/playerTuning, animals/locomotion/jump) · cf6259a chronometer +
  loading (ui/chronometer, ui/loading) · fd3c8ed + edce3e3 haptics (ui/haptics FEEL and the Menu > Feel defaults in
  core/renderSettings) · 92caeb5 footsteps (audio/footsteps) · 916af53 senses + senses halo (core/senses, core/senseBeacons) ·
  47b6b12 behaviour (core/animalBehavior) · 9683702 clock (core/timeOfDay, core/worldClock) · c1ea859 quality governor
  (core/quality). Every module keeps its export names; no call site changed. tsc + npm test after each step.
- 525b6d3 `tools/system-map.ts` -> `docs/system-map.md` (mermaid wiring, systems table, per-system figures / flags / linked
  tables / still in code, all-URL-flags index); `npm run system-map`; `tests/system-properties.test.ts`.
- bc125fa skill `notes/skills/system-properties.md`. 3854bcf pending group renamed autoFocus (T-0035 renamed it at 01:40).

## How to verify
`npm test` (366 tests: 354 pass, 0 fail, 12 todo on omen 01:47 PT) and `npx tsc --noEmit` (clean). tests/system-properties.test.ts:
values lock (every moved figure equals its pre-move literal), units + source for every figure, every listed reader really
contains `SYSTEM_PROPERTIES.<group>`, one owner system per group, known dependencies, modules and linked exports exist,
docs/system-map.md == renderSystemMap(). Open docs/system-map.md (VS Code / GitHub preview renders the mermaid diagram).
No frame gate: nothing on screen changes (rule 12 evidence gate instead; no browser was opened).

## Evidence (rule 12) - findings, evidence, what each became
| # | Finding | Evidence | Became |
|---|---|---|---|
| 1 | No single central config; partial ones per area | core/tuning.ts:5-37 (LEVEL/BLOCK/PHYS), core/playerTuning.ts:3, core/quality.ts:44-60, core/renderSettings.ts:15-25 | kept; linked from SYSTEM_MAP tables; the new file is the index |
| 2 | T-0035 / T-0036 already create the same file and shape | grok/interact-outline 035832b, grok/wolf-hydration efc87c9 `src/config/systemProperties.ts` | same `SYSTEM_PROPERTIES` shape; their groups in PENDING_GROUPS + SYSTEM_MAP |
| 3 | Settings defaults override module objects at load | core/renderSettings.ts:61-66 `default: .6` applied over FEEL by createSettingsStore | Feel defaults now read SYSTEM_PROPERTIES.haptics (edce3e3); Target frame rate / interest radii left (still in code) |
| 4 | Camera figures were bare literals | render/math.ts:13-29 (pitch 10/30 deg, spring 14, rider 1.6/3, clamp -80/89) | moved (583480e) |
| 5 | ~60 URL flags parsed in 17 files, undocumented | grep URLSearchParams: main.ts:101,164-166,400-404; globe/globeView.ts:80-88; render/trees/game.ts:18 ... | listed per system + index in docs/system-map.md |
| 6 | Open branches edit files with figures | `git diff --name-only main...<branch>`: wolfModes (T-0036), bindings/buildScene/main (T-0035), audio mixer/music (T-0033), globe inpage/globeView (T-0034), gaits/ik/hare (T-0009) | not moved; listed under "still in code" to move after those merge |
| 7 | `let x = EXPORT` infers literal types from `as const` | tsc on main.ts:201,209 (`altitude = RIDER_HEIGHT`) | exports annotated `: number` / live(); written into the skill |

Spot-check suggestion for the reviewer: 3 (renderSettings defaults), 4 (render/math diff in 583480e), 6 (diff lists).

## Number table (rule 6; only figures given a real-world source here; all moved values unchanged)
| Value | Game | Real figure + source | Nature? |
|---|---|---|---|
| Map latitude | 49.5 deg N | Thunder Bay 48.4 N, Kenora 49.8 N (NRCan Canadian Geographical Names Database) | yes |
| Fore / hind paw pitch | 0.96 / 1.04 | fore legs carry ~60 % of a dog's weight (Lee et al. 1999 J Exp Biol 202:3565) | yes (direction) |
| Player run / sprint | 6 / 10.5 m/s | wolf travel ~2.2-2.5 m/s, chase up to ~15-17 m/s (Mech 1970; Mech & Boitani 2003) | yes (inside range) |
| Target frame rate | 60 fps | desktop 60 Hz; Quest 72/90 Hz (Meta performance guidance) | yes |
| Everything else in the file | | marked "estimate (game calibration)", "design" or "Matthew" in PROPERTY_META | estimate |

## Leftovers (still in code; each listed in SYSTEM_MAP.remaining and the doc)
core/bindings DEADZONE/ACTIVE and wolfModes trigger thresholds + stamina rates (after T-0035 / T-0036), audio mixer/music (after
T-0033), globe figures (after T-0034), locomotion tables and HARE (T-0009; linked), main.ts mouse-look sensitivity, steer rate,
notice time, autosave interval; renderSettings defaults for Target frame rate, interest radii and LOD scales; sky / water shader
figures; render/buildScene field of view.

## Merge notes for T-0035 / T-0036 (add/add conflict on src/config/systemProperties.ts)
Keep every group alphabetically inside SYSTEM_PROPERTIES; delete the merged group from PENDING_GROUPS; add a PROPERTY_META entry
per merged group (readers: T-0035 autoFocus/targetGlow -> core/focusLock, core/bindings, render/buildScene, render/targetGlow, main;
T-0036 needsThoughts -> core/needs/thoughts, core/needs/template) with [units, source] per key; put the core/needs/* modules in
SYSTEM_MAP.needs.modules; `npm run system-map`; npm test.

## Needs from another agent
- None (approved by Matthew under rule 16). Next owner of T-0036: merge notes above for needsThoughts.

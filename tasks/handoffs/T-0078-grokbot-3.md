<<<<<<< HEAD
# T-0078 handoff — grokbot-3

## What this is
The one clock is now the time dial from issues #109, #108 and #107. Branch `grokbot-3/single-time-control`, pull request #92. Not merged. `565b2e6` was the unshifted curve (about 1.32× at the lip). The next commit on this branch shifts that curve so the lip is exactly 1×.

## What was built
- `src/core/worldClock.ts`. Dial −1..+1. Dead zone ±0.01 is still pause. The curve is shifted from #109's literal `10^(|p| × 12)`, which put 1× on the pause mark: magnitude = `10^(((|p| − 0.01) / 0.99) × 12)`. Edge is exactly 1×. Full deflection is still 10^12×. A nudge that crosses ±1× stops there until the gesture ends. Play sets +1×. Spring in decades, inertia `1 + error²`, stiffness 64, damping 13.6 (game calibration). `formatRate`, `resolveObservation`, `simWorldSec`, `groundWorldSec`, `epochOffsetYr`.
- `src/ui/timeHud.ts`. Hold − / + to move the dial. Label is the readable rate. Past about a year the date line is `deepTimeAt`.
- `src/core/bindings.ts`. Slower and faster are holds (comma / d-pad left, period / d-pad right). Pause stays a tap.
- `src/main.ts`. The held axis nudges the dial. Sky uses the signed world second. Ground advances only. Animals, the weather grid and gameplay audio run only forward and only while the scale is Immediate.
- `src/core/timeOfDay.ts`. `clockDate` clamps so a geological jump is not an Invalid Date.
- `src/animals/locomotion/lab.ts`. The pose holds when rewinding or above Immediate, so a huge rate cannot spin the step loop.

## How to verify
`./node_modules/.bin/tsc --noEmit` exit 0. `npm test` 792 tests, 778 pass, 0 fail, 14 todo.

Ground view, start menu skipped: `/?nomenu&view=ground&noprobe&hour=11`. The bar reads `1 sec / sec`. Hour opens the chronometer. `?timescale=3600` reads `1 hour / sec`. `?timescale=31557600000` reads `1,000 years / sec` and a deep-time label.

## Numbers
| value | game | real figure | source | matches? |
| --- | --- | --- | --- | --- |
| dead zone 0.01, exponent ×12 | pause, then up to 10^12× | the issue's own samples: 0.1 → ~15.8×, 0.3 → ~3981×, 0.5 → 10^6, 1 → 10^12 | #109 | yes, tested |
| real time | exactly 1× at dial ±0.01 | #109 literal `10^(|p|×12)` puts 1× at position 0, which is pause. Matthew, 2026-10-25 19:46 PT: shift the same 12 decades so the dead-zone edge is 1× and ±1 is still 10^12× | this correction of #109 | yes, tested. A deviation from the literal issue, recorded in the pull request |
| julian year in the label | 365.25 d | IAU julian year | `src/data/constants.json` | yes |
| spring 64 / 13.6, inertia 1+error² | a notch moves within a second; 12 decades takes a few seconds and does not jump | #109 "several seconds", game calibration | this task | tested, not a natural rate |
| hysteresis 800 / 1200 | behavior stays until 1200, returns below 800 | #109 example | #109 | yes, tested |
| other scale edges | 10×, 10^5×, 10^7×, then 10^9, 10^10, 10^11 with the same 0.8/1.2 gap | #108 bands, split so all eight names fit under 10^12 | #108, #109 | design, tested |

## Frames
Before (the old ×1 bar): `/opt/cursor/artifacts/time_bar_play_1280.png`, `time_bar_hour_1280.png`, `time_bar_play_750.png`, `time_bar_hour_750.png`.

After the 1× correction, in `/opt/cursor/artifacts/`: `time_dial_realtime_play_1280.png`, `time_dial_realtime_hour_1280.png`, `time_dial_realtime_play_750.png`, `time_dial_realtime_hour_750.png`. Those read `1 sec / sec`. The earlier `time_dial_play_*` stills show the 1.32× lip and are superseded. `time_dial_hour_per_sec_1280.png` and `time_dial_thousand_years_1280.png` still show those rates.

What I see: a dark pill at the top centre. At rest it says the morning hour, the date, and `1 sec / sec`, with Pause, Play, −, +, Hour. Hour opens the round chronometer on the right. At 1 hour/sec the line says ecological. At 1,000 years/sec the line says a deep-time label and geological. The Boreal title stays on the left. At 750px wide the pill is still one line and does not cover the title. A nature reference does not apply to a readout. N/A.

## What cannot rewind (honest)
The clock and the hour go backward. Ground years do not. Animals, needs, physics, the weather grid and gameplay sounds hold while rewinding and while the scale is above Immediate. Cloud drift drops a negative gap. The calendar Date is clamped. The observation signal is not wired into those systems. That wiring is a later task.

## Needs from another agent
None for the bar. Later tasks wire each system to `observation()`.
=======
# T-0078 handoff (grokbot-3)

**Status:** claimed. grokbot-1 approve-plan at 2026-10-26 00:20 PT covers the plan and phase 1 only. Phase 1 is the unread table in `src/render/observationTable.ts`. The picture does not import it. Later phases are not started. Not complete. grokbot-3 does not approve this plan.

**Branch:** `grokbot-3/render-unification-plan`
**Plan:** `notes/render-unification-plan.md`
**Skill:** `notes/skills/render-path-audit.md`
**Pin:** `e7b9ab7` (main, 2026-10-25 17:13 PT). Line numbers are from that commit.

## What this run is doing

Matthew asked for one rendering system, and for the plan to open in plain language. He then answered the three open questions in issues #107, #108, and #109, and at 7:15 PM PT on 2026-10-25 gave permission to rewrite a render path when keeping it would compromise the single space-and-time observation pipeline. This revision records those answers, removes the open decisions, and makes layer choice follow height and the time dial together. No drawing code. The propose event from 18:34 PT still stands. This is not an approve-plan.

## Done

- Scanned task ids across `git log --all` and open pull requests. Highest taken id is T-0077 (`grokbot-3/menu-no-bounce`, PR #91). This task is T-0078. T-0046 stays reserved.
- Inventoried the forest picture, the planet picture, the fade between them, and the dev pages. Evidence is in the plan.
- `grokbot-3/globe-enter-fix` and `grokbot-3/single-time-control` were not on origin at the pin. The plan still leaves their files alone.

## Not done

- Phases 2 onward. grokbot-1 approved phase 1 only. Each later phase is its own pull request.
- No complete event. The picture is still two pictures.
- No frame recording. Nothing on screen changes. Frame gate is N/A. Evidence gate is this file (rule 12).

## Revision (issues #100–#109)

Matthew's newest issue wins. #109 overrides #108 and #107 where the rates disagree. The plan's answers:

1. The flight down is one smooth picture. The fade is removed in a later phase.
2. Far forest is a colour and a density. Trees appear close in and when time is slow. #107's stations: orbital weather, season, and vegetation density; about 1 km habitats; about 100 m animals and trees; ground grass, tracks, and scents. The full list, including 100 km and continental, is in the plan.
3. Several small steps. The first one is the unread table.

The time dial's rate and level feed the layer weights (#108, #109). The chronometer scrubs the hour. `timescale.ts` is a 0.05–1 slow-motion multiplier. Neither becomes the dial. The clock files stay untouched until `grokbot-3/single-time-control` has merged. Hysteresis and the blend are #109's cited pair: enter 1,200×, exit 800×, smooth step from 800 to 1,200. Stiffness, damping, the geological enter rate, and the biome enter rate are not in the issues and are left unset.

Permission, recorded in the plan: replace a path that would compromise that one pipeline. The fade, the distance-only cutoffs, and the slow-motion knob as a layer switch are replacements. The forest renderer, the frame loop, the quadtree, and the pixel-size gate (as the spatial score only) stay.

## Evidence (rule 12)

Reviewer: open at least three rows at `e7b9ab7` and confirm the line. "Became" is a phase in the plan, or nothing.

| Finding | Evidence at e7b9ab7 | Became |
|---|---|---|
| Forest has its own renderer, scene, camera, and draw | `src/render/buildScene.ts:71`, `:78`, `:83`, `:366` | Keep. It is the one surface and the one draw |
| Forest loop is `main.ts` | `src/main.ts:372` and `:490` | Keep. The one loop |
| Standalone planet has a second renderer, scene, camera, and loop | `src/world/globe/globeView.ts:86`, `:91`, `:125`, `:131`, `:525` | Phase 3 removes the extra loop. Phase 9 removes the extra renderer |
| Shared planet borrows the forest renderer and refuses to dispose it | `src/world/globe/globeView.ts:66–68`; `src/world/globe/inpage.ts:89`, `:115` | Merge into the one scene (phase 7) |
| The band draws the planet into an image, then draws the forest on top, with a cleared depth | `src/world/globe/inpage.ts:5–7`, `:274–280`; `src/world/globe/farLayer.ts:1–6` | Phases 7 and 9. The comment in `farLayer.ts` is the double-picture cost |
| Log depth is per material because a renderer flag would rebuild the forest programs | `src/world/globe/logDepth.ts:1–6` | Keep the per-material path. Do not flip the renderer flag |
| Colour is patched on the way down (land tint, lake colour, haze, fog, occlusion) | `src/world/globe/inpage.ts:46–58` and `:284` | Those patches become unused in phases 6 and 7 |
| Two skies | Planet shell `src/world/globe/atmosphere.ts:211`. Forest sky `src/render/sky.ts:68` and `:74`. Koschmieder fog `:132` | Phase 6. One air |
| Three cloud drawings | Shell `atmosphere.ts` `CLOUDS` line 45. Local box `src/world/globe/localClouds.ts:15`. Forest dome `sky.ts:74` | Shell and local box stay, chosen by the resolver. Dome goes in phase 6 |
| Planet ocean is a colour on the tile. Forest water is another material | `src/world/globe/tile.ts:216–221` and `:239`. `src/render/water.ts:23`. `buildScene.ts:118–120` | Keep forest water as the near layer. Tile colour is the far layer |
| Snow and plants on the planet are textures. Forest snow and trees are meshes | `src/world/globe/hydroLayer.ts:27–37`. `src/render/pbr.ts:45`. `src/render/trees.ts:217`. `src/render/trees/game.ts:18` | Phase 5 blends forest colour and trees. Both tree drawers stay until every species is a row in the second |
| Feature-size gate exists and only the planet snow, ice, and soil use it | `src/world/globe/visibility.ts:11–31`. `src/world/globe/planetLayers.ts:68–73` | Kept as the spatial score. Phase 4 multiplies it by the time-dial score. It is not the whole decision |
| Layer list already names clouds through airglow | `src/world/globe/layerPanel.ts:7–11` | Keep |
| Venus is switched on the planet panel and drawn in the forest sky | `layerPanel.ts:7`. `src/render/sky.ts:70`. `src/render/venusSky.ts:21` | Phase 6 parents the existing points to the one scene |
| Grass, flowers, and animals are near-only | `src/render/grass/cover.ts:73–74`. `src/render/flora/flora.ts:39`. `buildScene.ts:225` | Keep as the near, slow end. Phase 8 puts each on the resolver. Tracks and scents are not world layers yet |
| Photos reuse the same draw | `src/render/buildScene.ts:410–418`. `src/camera/gameCamera.ts:46` | Keep |
| Target outline is a second scene on the same renderer | `src/render/targetGlow.ts:34–35` | Keep. It is an overlay, not a second world |
| Dev pages have their own renderers | `src/world/sun/sunView.ts:52`. `src/animals/locomotion/lab.ts:42`. `src/render/trees/viewer.ts:23`. `src/ui/pad3d.ts:18`. `src/world/globe/farLayerDemo.ts:23` | Leave. They are not the flight. The proof page goes with the far image |
| Page entry picks among those pictures | `src/world/globe/entry.ts:4–6` | Phase 9 makes `?view=globe` a mode of the forest entry |
| The split is historical | Forest snapshot `56506c5` (2026-10-15). Planet page `988e564` (2026-10-18). Fade `39954d7`. Air `0ce9ada`. Default globe PR #33 T-0034. Descent polish PR #35 T-0041 | The plan's history table. No code change |

## Numbers

Heights and sizes already in the code stay copies of those constants (`HANDOFF.alt` 2000 m, `TRANSITION.fadeFull` 600 m, `TRANSITION.handover` 60 m, interest 60 / 100 m, grass radius 48 m, eye acuity 2.9e-4 rad in `visibility.ts` with its citation, governor target 60 fps in `src/config/systemProperties.ts:173`). The observation stations and rates are Matthew's issues, not new measurements: #107's ground, 100 m, 1 km, 100 km, continental, and orbital stations; #109's time levels (0.1×–50×, 20×–500×, 100×–10,000×, 1,000×–1,000,000×, and evolution from 100,000×) and the hysteresis pair enter 1,200×, exit 800×, blend 800 to 1,200. #109's dial shape is position −1…+1, a dead zone inside 0.01, and ten raised to the power of (twelve times the absolute position). Stiffness, damping, a biome enter rate, and a geological enter rate are absent from the issues and are not invented.

## How to verify

1. Open `notes/render-unification-plan.md`. The first section is the plain summary. The answers are recorded under it. There is no open decision. The 7:15 PM PT rewrite permission is in "What this document is".
2. Pick three inventory rows. Open the file at `e7b9ab7` at the cited line.
3. Confirm this branch does not modify `src/world/globe/inpage.ts`, `src/world/globe/globeView.ts`, or the clock files.
4. Confirm this revision does not modify drawing code. The earlier local check on the audit still stands: `npx tsc --noEmit` exit 0, `npm test` 777 tests, 763 pass, 0 fail, 14 todo. A screen recording is N/A. CI for this revision is the run on the commit that updates the plan, named on the pull request. It is not copied back into this file.

## Needs from another agent

grokbot-1's approve-plan is on the branch (`tasks/events/2026-10-26T00-20-00-grokbot-1-approve-plan-T-0078.json`). A review of phase 1, from an agent other than grokbot-3, before phase 2.

No reference images and no recording. Nothing visible changed.

## Next step

Phase 1 is the table and `tests/observationTable.test.ts`. Wait for another agent's review of that step. Do not start phase 2 until that review asks for it. The in-page flight and the clock stay untouched. The time wheel stays on pull request #92.

## Review note (rule 15)

This run's instruction is Matthew's rendering audit. Open pull requests at the start: #91 `grokbot-3/menu-no-bounce` (T-0077, this same agent, not reviewed here) and #90 `grokbot-1/solar-cloud-feed` (open, not a completed task waiting on this agent). No approve was issued.
>>>>>>> main

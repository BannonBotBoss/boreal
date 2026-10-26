# T-0078 handoff (grokbot-3)

**Status:** proposed. Audit and plan only. No drawing code. Not claimed. Not complete. grokbot-3 does not approve this plan.

**Branch:** `grokbot-3/render-unification-plan`
**Plan:** `notes/render-unification-plan.md`
**Skill:** `notes/skills/render-path-audit.md`
**Pin:** `e7b9ab7` (main, 2026-10-25 17:13 PT). Line numbers are from that commit.

## What this run is doing

Matthew asked for one rendering system, with distance choosing the layers, and for the existing code to be reused. He also asked that the plan open in plain language. This run writes the audit, the plan, the task, this handoff, and a propose event.

## Done

- Scanned task ids across `git log --all` and open pull requests. Highest taken id is T-0077 (`grokbot-3/menu-no-bounce`, PR #91). This task is T-0078. T-0046 stays reserved.
- Inventoried the forest picture, the planet picture, the fade between them, and the dev pages. Evidence is in the plan.
- `grokbot-3/globe-enter-fix` and `grokbot-3/single-time-control` were not on origin at the pin. The plan still leaves their files alone.

## Not done

- No approve-plan. Another agent or Matthew approves before implementation.
- Phase 1 (copy existing ranges into one unread table) is listed and not implemented.
- No frame recording. Nothing on screen changes. Frame gate is N/A. Evidence gate is this file (rule 12).

## Evidence (rule 12)

Reviewer: open at least three rows at `e7b9ab7` and confirm the line. "Became" is a phase in the plan, or nothing.

| Finding | Evidence at e7b9ab7 | Became |
|---|---|---|
| Forest has its own renderer, scene, camera, and draw | `src/render/buildScene.ts:71`, `:78`, `:83`, `:366` | Keep. It is the one surface and the one draw |
| Forest loop is `main.ts` | `src/main.ts:372` and `:490` | Keep. The one loop |
| Standalone planet has a second renderer, scene, camera, and loop | `src/world/globe/globeView.ts:86`, `:91`, `:125`, `:131`, `:525` | Phase 3 removes the extra loop. Phase 7 removes the extra renderer |
| Shared planet borrows the forest renderer and refuses to dispose it | `src/world/globe/globeView.ts:66–68`; `src/world/globe/inpage.ts:89`, `:115` | Merge into the one scene (phase 6) |
| The band draws the planet into an image, then draws the forest on top, with a cleared depth | `src/world/globe/inpage.ts:5–7`, `:274–280`; `src/world/globe/farLayer.ts:1–6` | Phase 6 and 7. The comment in `farLayer.ts` is the double-picture cost |
| Log depth is per material because a renderer flag would rebuild the forest programs | `src/world/globe/logDepth.ts:1–6` | Keep the per-material path. Do not flip the renderer flag |
| Colour is patched on the way down (land tint, lake colour, haze, fog, occlusion) | `src/world/globe/inpage.ts:46–58` and `:284` | Those patches become unused in phases 5 and 6 |
| Two skies | Planet shell `src/world/globe/atmosphere.ts:211`. Forest sky `src/render/sky.ts:68` and `:74`. Koschmieder fog `:132` | Phase 5. One air |
| Three cloud drawings | Shell `atmosphere.ts` `CLOUDS` line 45. Local box `src/world/globe/localClouds.ts:15`. Forest dome `sky.ts:74` | Shell and local box stay, by altitude. Dome goes in phase 5 |
| Planet ocean is a colour on the tile. Forest water is another material | `src/world/globe/tile.ts:216–221` and `:239`. `src/render/water.ts:23`. `buildScene.ts:118–120` | Keep forest water as the near layer. Tile colour is the far layer |
| Snow and plants on the planet are textures. Forest snow and trees are meshes | `src/world/globe/hydroLayer.ts:27–37`. `src/render/pbr.ts:45`. `src/render/trees.ts:217`. `src/render/trees/game.ts:18` | Phase 4 gates them. Both tree drawers stay until every species is a row in the second |
| Feature-size gate exists and only the planet snow, ice, and soil use it | `src/world/globe/visibility.ts:11–31`. `src/world/globe/planetLayers.ts:68–73` | Phase 4 extends it. No new gate |
| Layer list already names clouds through airglow | `src/world/globe/layerPanel.ts:7–11` | Keep |
| Venus is switched on the planet panel and drawn in the forest sky | `layerPanel.ts:7`. `src/render/sky.ts:70`. `src/render/venusSky.ts:21` | Phase 5 parents the existing points to the one scene |
| Grass, flowers, and animals are near-only | `src/render/grass/cover.ts:73–74`. `src/render/flora/flora.ts:39`. `buildScene.ts:225` | Keep. Phase 4 makes the gate explicit |
| Photos reuse the same draw | `src/render/buildScene.ts:410–418`. `src/camera/gameCamera.ts:46` | Keep |
| Target outline is a second scene on the same renderer | `src/render/targetGlow.ts:34–35` | Keep. It is an overlay, not a second world |
| Dev pages have their own renderers | `src/world/sun/sunView.ts:52`. `src/animals/locomotion/lab.ts:42`. `src/render/trees/viewer.ts:23`. `src/ui/pad3d.ts:18`. `src/world/globe/farLayerDemo.ts:23` | Leave. They are not the flight. The proof page goes with the far image |
| Page entry picks among those pictures | `src/world/globe/entry.ts:4–6` | Phase 7 makes `?view=globe` a mode of the forest entry |
| The split is historical | Forest snapshot `56506c5` (2026-10-15). Planet page `988e564` (2026-10-18). Fade `39954d7`. Air `0ce9ada`. Default globe PR #33 T-0034. Descent polish PR #35 T-0041 | The plan's history table. No code change |

## Numbers

This plan introduces none. The distances it names are copies of constants already in the files above (`HANDOFF.alt` 2000 m, `TRANSITION.fadeFull` 600 m, `TRANSITION.handover` 60 m, interest 60 / 100 m, grass radius 48 m, eye acuity 2.9e-4 rad in `visibility.ts` with its citation, governor target 60 fps in `src/config/systemProperties.ts:173`). A later phase that needs a new number cites a source or marks game calibration.

## How to verify

1. Open `notes/render-unification-plan.md`. The first section is the plain summary, with three decisions.
2. Pick three inventory rows. Open the file at `e7b9ab7` at the cited line.
3. Confirm this branch does not modify `src/world/globe/inpage.ts`, `src/world/globe/globeView.ts`, or the clock files.
4. Local checks: `npx tsc --noEmit` exit 0. `npm test` 777 tests, 763 pass, 0 fail, 14 todo. No drawing code changed, so a screen recording is N/A. CI on the pull request runs the same two commands.

## Needs from another agent

An approve-plan, or a reject-plan, from an agent other than grokbot-3 (or from Matthew, recorded by a relay with `"for": "matthew"` and his words). Do not start phase 1 until that exists.

No reference images and no recording. Nothing visible changed.

## Next step

Wait for approve-plan. If the answer to decision 1 is yes and decision 3 is A, the next owner implements phase 1 only: a table of existing constants plus a test that they match, no draw change, and still no edits to the in-page flight or the clock.

## Review note (rule 15)

This run's instruction is Matthew's rendering audit. Open pull requests at the start: #91 `grokbot-3/menu-no-bounce` (T-0077, this same agent, not reviewed here) and #90 `grokbot-1/solar-cloud-feed` (open, not a completed task waiting on this agent). No approve was issued.

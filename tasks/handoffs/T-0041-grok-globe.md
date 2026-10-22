# T-0041 handoff (grok-globe)

- **Doing:** cloud deck fade + clear landing view (tasks/T-0041-descent-polish.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/descent-polish, worktree C:\dev\boreal-grok-descent-polish (from origin/main b441f1d).
- **Status:** proposed 1c4a9e7 (03:00 PT); test + code + evidence on the pushed branch; NOT claimed, completed or PR'd: no approve-plan exists yet (checked all fetched branches at 03:37 PT). Next owner step: approve-plan (rule 16b by Grok for Matthew, or another agent) -> claim -> skill update -> complete -> PR.

## Built (tests first 49053b9; code 145f01d, de97849)
- **Cloud deck** (`transition.ts` cloudClear, `atmosphere.ts`): the in-page descent no longer raises the coverage threshold
  (T-0034 ffa36b2: the 900 km cell over home crossed the threshold in ~3 frames: solid cream -> clear ground). The cover alpha and
  the cloud shadows are multiplied by (1 - clear); clear = linear in log altitude from `CLOUD_OPEN.top` 1500 km (0) to
  `bottom` 150 km (1). Standalone globe unchanged (setClear only in shared mode).
  First try 2500 -> 25 km (145f01d) was smooth but left a long uniform beige haze (afterv1-cloud-0256km.jpg); narrowed in de97849.
- **Landing view** (`handoff.ts`): `landSpawnSteps(at, staged, yaw)` runs `clearViewSteps` after the dry-land search: the
  nearest spot (rings of 1.5 m, <= 12 m) that is dry (`surfaceAt.isDry`, the dryStart test) and has no tree within
  `max(0.6, 0.45 r)` of the line from the follow camera (rider distance 3 m + 0.5) to the wolf; heading kept. Trees:
  `core/ground.treesAround` (the existing per-chunk placement cache, crown radius r). inpage passes the descent heading
  (both the budgeted search and descend's sync fallback). Dev hook `__inpage.view` / `player()` for the browser raycast.

## Measurements (refs/T-0041/measure.mjs, bench lock, headless Edge, :5182 = T-0034 branch = main's logic, :5184 = this branch)
- **Cloud jump** (clouds mode: 36 jumpTo stills 1200 -> 150 km, mean luminance of the central 60 % crop; per-frame change =
  step / frames between the two altitudes at the fastest recorded descent, 2.40 ln-alt/s from refs/T-0034/descent-frames.json).
  Limit <= 2 % of full scale per 60 fps frame (<= 4 % at 30 fps) through 600-200 km.

| run | max luminance change / 60 fps frame | / 30 fps frame | where |
|---|---|---|---|
| before (threshold switch) | **17.0 %** | 34.0 % | 241 -> 227 km (lum 139 -> 74) |
| after v1 (2500 -> 25 km) | 0.4 % | 0.9 % | smooth, but beige haze 500-150 km |
| after (1500 -> 150 km) | **1.8 %** | 3.6 % | 214 -> 202 km |

  Calibration: the reviewed snap (before) fails by 8x, the fade passes. The cream-pixel fraction (bright, unsaturated) is NOT a good
  metric: a half-faded cloud is grey, so the fraction drops to 0 at 50 % alpha (logged, not used). Node test: cloudClear step on the
  same descent 0.9 % per 60 fps frame (old function 3.9 %).
- **Landing line of sight** (node, tests/descent-polish.test.ts): 48 seeded landings (staged seed 1400): raw (T-0034) spots with a
  tree in the camera's view 2/48; with the view search 0/48 blocked, all dry, max shift 1.56 m.
- **Browser raycast** (seeds mode: spawn at the raw and the chosen spot with `?at=x,z,yaw`, raycast from the GAME camera to the wolf
  0.5 m up against every visible scene mesh; hit > 0.6 m before the wolf = blocked): seed 9 raw **blocked** (Mesh 0.56 m in front of the
  camera: a trunk fills the frame, after-seed9-raw.jpg) -> chosen clear (1.5 m away; wolf in view); seed 38 raw clear by raycast but a
  trunk beside the wolf (after-seed38-raw.jpg) -> chosen clear, no trunk; seeds 0-3 clear in both (spot unchanged). Calibration:
  the known occlusion (seed 9 raw) reads blocked, the visible wolves read clear.
- Bare-load descent landing (land mode, the reviewed path): before (599.2, -2066.5) and after (605.8, -2066.2) both show the wolf; the
  reviewed trunk case did not recur this run (the landing jitters a few metres with timing). After: raycast clear.

## Checks
- npm test 396 pass / 0 fail (409 incl. skips); `npx tsc --noEmit` clean; smoke-tiers PASS on :5184 at 145f01d (Ultra 109 fps 265 draws)
  and again at de97849 (Ultra 87 fps 265 draws, Minimum 214 fps; machine shared with other benches).

## Frame answers (rule 6)
- before-cloud-*: 1200 km cloud patches over blue water; 554-288 km one cream cloud fills the frame; 256 km torn; 227 km clear forest
  and lakes (the snap). after-cloud-*: 1200 km the same; 703 km cloud; 554 km cloud slightly thinner; 366-256 km a thin haze with lakes
  showing through; 150 km clear ground. Natural? Descending toward a deck you see it thin and break; the fade reads as thinning haze, not a
  cut. Reference: the T-0034 oblique reference (refs/T-0034/reference-oblique.jpg) is what to look for at the end (clear ground, haze at
  the horizon). 95 % gate: N/A (a transition timing fix); substituted the calibrated luminance-jump and raycast checks above.

## Leftovers
- Rocks and logs are not in the view check (after-descent-land.jpg: a boulder covers the wolf's legs); trees only, as scoped.
- The haze between ~550 and 250 km is uniform (a 900 km cell is the whole view); a cloud texture that breaks up would need the
  threshold again, ramped per pixel (bigger change).
- Vite worktrees share node_modules/.vite through the junction: two dev servers starting together collided on .vite/deps (restart fixed it).

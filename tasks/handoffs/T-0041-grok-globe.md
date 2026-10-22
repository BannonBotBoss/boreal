# T-0041 handoff (grok-globe)

- **Doing:** cloud deck fade + clear landing view (tasks/T-0041-descent-polish.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/descent-polish, worktree C:\dev\boreal-grok-descent-polish (from origin/main b441f1d).
- **Status:** completed. Proposed 1c4a9e7 (03:00 PT); approve-plan by grok for matthew 03:52 PT (ceb790f on main, rule 16); origin/main merged (029fbce); claimed 3034208; follow-ups (rocks/logs, haze) b104ede..68c3c8e; complete event + PR. Review via tools/agent-review.mjs; not merged.

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

## Follow-ups after the approve (Matthew via Grok Bot, 03:53 PT)
### Rocks and logs in the view check (tests b104ede, code 0fccabc)
- `core/ground.solidsAround(x, z)`: rocks and logs from the same generateChunk entities (3x3 chunks, per-chunk cache like treesAround).
  Rock = disc r = d/2, top 0.7 d (core/rocks rockDiameter x entity scale). Log = segment +-2.2 m x scale along the yaw-turned axis
  (render/geometry 4.4 m log), r .43 x scale, top .85 x scale.
- `viewBlocked(x, z, yaw, trees, solids)` is 2.5D for solids: blocked when one reaches within r + .15 m of the camera-wolf line AND
  stands taller than the line there (0.5 m at the wolf -> rider height 1.6 m at the camera). Pebbles, cobbles and logs near the
  camera pass under the line. Trees unchanged.
- Node, 400 seeded landings: raw spots blocked by a tree 29, by only a rock/log 23; after 0/400 blocked, max shift 4.46 m.
  Test (200 landings): 8 tree + 11 rock/log raw blocks -> 0, all dry, <= 12 m.
- Browser, the 3 first rock/log-only seeds (refs/T-0041/rock-seed*.jpg, seeds-rocklog*.json): the body raycast (0.5 m) reads all six
  spots clear, but the stills show seed 86 raw: a log across the wolf's legs and lower body -> chosen: wolf clear; seed 102 raw: a
  foreground boulder over the legs -> chosen: clear; seed 75: a big boulder beside the wolf, not over it (false positive, 1.5 m
  shift, harmless). So the check is a little conservative; it catches leg/lower-body occlusion the centre raycast misses.

### The 366-256 km haze (tests e6758fc, code 68c3c8e)
- **Cause:** the home view sits inside one 900 km cloud cell whose density only spans ~.62-.71. measure.mjs sweep mode holds clear at 0
  and raises the threshold at 300/450/600 km: luminance 196 (.62) -> 140 (.66) -> 63 (.70) -> ground 59-64 (sweep-300-450-600km.json,
  s300-sweep-*.jpg). At the calibrated threshold (.613) the whole view is covered, so the alpha-only fade showed one flat
  translucent sheet over everything (no holes, no texture) until ~150 km.
- **Fix:** the shader also lifts the coverage threshold by `CLOUDS.clearLift` (.08) x cloudClear (cover and shadows), with the
  alpha fade still bringing it to 0 at 150 km. The deck breaks into clouds and holes from ~600 km and is mostly open by 256 km.
- **Numbers** (clouds mode, central-crop luminance, per frame at 2.40 ln-alt/s through 600-200 km):

| run | max / 60 fps frame | / 30 fps | lum 554 / 366 / 256 / 150 km |
|---|---|---|---|
| before (main threshold switch) | 16.97 % | 33.95 % | 186 / 195 / 183 / 59 |
| fade only (de97849) | 1.78 % | 3.57 % | 157 / 144 / 121 / 59 |
| fade + lift .08 (68c3c8e) | **1.20 %** | 2.40 % | 130 / 103 / 81 / 60 |

  The test models the same thing from the sweep curves (all three altitudes): <= 2 % per 60 fps frame, cover share between 15 and
  85 % at 450 and 366 km (broken, not flat), < 50 % by 256 km. Lift .1 modelled 1.57 %, opens a bit early; .08 kept margin.
- Stills: lift-cloud-*.jpg; grid-clouds.jpg rows = before / fade only / final at 703, 554, 366, 256, 227, 150 km. The before and
  fade-only rows were shot before T-0039 (HUD visible); the final row is on merged main (HUD hidden on the globe).

### Checks (after the follow-ups, on main + branch)
- npm test 401 pass / 0 fail (414 incl. 13 todo); tsc --noEmit clean; smoke-tiers PASS on :5185 (Ultra 126 fps 265 draws, High 127,
  Medium 117, Low 140, Very low 143, Minimum 241 fps).

## Leftovers
- The solid check uses footprint radii and a flat-ground line height; terrain slope between camera and wolf is ignored.
- The clouds-mode luminance includes the terrain getting closer; the per-frame figure is an upper bound on the cloud part.
- Vite worktrees share node_modules/.vite through the junction: two dev servers starting together collided on .vite/deps (restart fixed it).

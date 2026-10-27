# T-0096 handoff (grokbot-3)

Branch: `grokbot-3/one-viewpoint`. Pull request: https://github.com/BannonBotBoss/boreal/pull/143. Not merged. Not claimed. Not self-approved.

## What this run is doing

Phase 2 of `notes/render-unification-plan.md`: one viewpoint above the band. Issue #107. The forest camera is the planet camera from orbit down. Two scenes stay. `blendSec` is a no-op. The free-fall entry stays.

## Id scan

`git fetch origin main` and the five open PR heads at the start. Highest task id on any branch was T-0095 (`grokbot-3/no-raw-world`, PR #142). Next free id is T-0096. T-0046 stays unused.

Open PRs at the start, none of which touch `inpage.ts`, `globeView.ts`, `transition.ts`, or `buildScene.ts`:

| PR | Branch | Task | Camera files |
| --- | --- | --- | --- |
| 142 | grokbot-3/no-raw-world | T-0095 | no |
| 141 | grokbot-3/climate-class | T-0094 | no (climate class only; left alone) |
| 140 | grokbot-3/solar-epoch | T-0093 | no (clock file; left alone) |
| 139 | grokbot-3/snow-depth | T-0087 | no (`main.ts`, weather, ground; left alone) |
| 137 | grokbot-3/animals-in-store | T-0092 | no |

All five are grokbot-3's own open work. Not reviewed here. grokbot-2 is offline and is not tagged. Climate, weather, and clock files were not edited.

## What was built

- `viewpointPose` is the old band pose: `(x, groundY + height, z)`, `Euler(pitch, yaw, 0, 'YXZ')`. The band and the climb write that pose.
- `handoverBlend` returns that pose. `TRANSITION.blendSec` stays 1 and is not read. Becoming the animal no longer lerps a second camera for one second.
- Above the band, `attachViewpoint` maps the planet camera onto the forest camera only when `forestFromPlanet` round-trips within 1 cm and 1e-4 rad. Off the home-facing hemisphere the fall's `lookAt` / `rotateZ` / `rotateX` stays.
- `orbitClip` is the limb clamp `globeView` already used. No new near or far.
- Two scenes stay. Globe mode calls `globe.step(null)` once. The band calls `globe.step(far.target)` once inside the forest draw. `STATS` still sums `globeMs + drawMs`, so planet time in the band is still inside both numbers.

## Number table

No new world size, rate, or clip. The centimetre is the plan's test tolerance.

| Value | Game | Real figure | Source | Match |
| --- | --- | --- | --- | --- |
| Band top / 2 km still | 2000 m | existing handoff | `HANDOFF.alt` | yes, not new |
| Full patch / 600 m still | 600 m | existing | `TRANSITION.fadeFull` | yes, not new |
| Handover / 60 m still | 60 m | existing | `TRANSITION.handover` | yes, not new |
| Pose tolerance | 0.01 m | the plan's test, not a terrain size | render plan phase 2 | yes |
| `blendSec` | 1, unused | the old one-second blend | `transition.ts` | yes, not applied |
| Orbit near / far | alt × 0.02, clamped 0.5 m … 100 km; limb past the mean sphere | the clip already in `globeView` | moved into `orbitClip` | yes, not new |
| Fall end, spin, pitch | 3048 m, +180°, −35.264° | unchanged from T-0088 | NIST 0.3048 m/ft; isometric arctan(1/√2) | yes |

## Tests

- `npx tsc --noEmit` exit 0 (2026-10-26 16:49 PT).
- `npm test`: 842 tests, 828 pass, 0 fail, 14 todo. The three new tests are in `tests/viewpoint.test.ts`. Main before this phase was 839 tests, 825 pass, 14 todo.
- At 2 km, `viewpointPose` matches `(x, groundY + 2000, z)` with gap 0. The in-game probe at 2000 m, 600 m, and 60 m also reported gap 0.
- GitHub `ci / test` on PR #143 (run 40421038987) failed in 3 seconds with no steps. The annotation says the job was not started because recent account payments have failed or the spending limit needs to be increased. That is the org billing limit, not a failure of this branch. Local `npm test` is the run that executed.

## Frames

Headless Chrome, swiftshader, `node` capture on `?start=globe&stages=1&trees=v2&noprobe&inpagedev`. This branch on port 5275, 2026-10-26 16:46 PT. The same script on main (`3c31e29`) is the budget comparison. The 95% resemblance score is unmeasurable here: there is no calibrated reference strip, and swiftshader is not a nature photograph. The measured locks are elevation, height, the position gap, and that the four images are different pictures.

| Frame | Probe |
| --- | --- |
| `orbit.png` | mode globe, altitude 14,016,219 m, elevation −90.0°, 16 tiles drawn. Whole disc, straight down. |
| `2km.png` | mode band, drone, height 2000 m, elevation −35.264°, position gap 0 m, fade 0. The forest patch is not in yet. Isometric terrain. |
| `600m.png` | height 600 m, elevation −35.264°, gap 0 m, fade 1, chunks ready. Canopy in front, the planet limb still behind it. |
| `60m.png` | height 60 m, elevation −35.264°, gap 0 m, fade 1, chunks ready. Closer canopy and lakes, the planet limb still behind it. |

Files: `tasks/evidence/T-0096/`. Copies: `/opt/cursor/artifacts/orbit.png`, `2km.png`, `600m.png`, `60m.png`.

## Perf

`STATS` sum is `globeMs + drawMs`, the same formula as today. Median of the last 24 logged frames, swiftshader:

| Height | This branch | Main `3c31e29` |
| --- | --- | --- |
| Orbit | 2.3 ms | 1.7 ms |
| 2 km | 1.3 ms | 1.7 ms |
| 600 m | 3.6 ms | 2.7 ms |
| 60 m | 3.8 ms | 3.0 ms |

The last-frame planet step (`globeMs`) was 0.4–1.2 ms on both. Orbit records `drawMs` 0 because the forest is not drawn. The band records one `globe.step(far.target)`. A second planet pass would put a second step in the frame; there isn't one. The 600 m and 60 m medians sit under a millisecond above that run of main, and the last three 60 m frames went the other way (5.6 ms here, 6.6 ms on main). That spread is the tile work already in the band, not a second draw.

## Done

- [x] Pose shared (`viewpointPose`), handover is `handoverBlend` (no-op), orbit maps the forest camera when the round trip is within a centimetre
- [x] `npx tsc --noEmit` exit 0. `npm test` 842 tests, 828 pass, 0 fail, 14 todo
- [x] Stills at orbit, 2 km, 600 m, 60 m
- [x] Skill `notes/skills/one-viewpoint.md`

## Descent picture (2026-10-26 17:39 PT)

The stills above are not a finished descent. This run stays on `grokbot-3/one-viewpoint` and pull request #143. Not claimed. Not self-approved.

Rule 15 at 2026-10-26 17:39 PT: `gh pr list` open PRs are 145, 144, 143, 142, 141, 140, 139, 137. Every head is a `grokbot-3/` branch. None were written by another agent, so none are reviewed or approved here. grokbot-2 is offline until about Oct 28 midday PT and is not tagged.

### Causes, measured on the committed stills (`tasks/evidence/T-0096/`, 1100×700)

- **2 km blank green-grey.** `gameToPlanet` placed the camera on the mean sphere (`p.radius + datum + y`). Tiles sit on `figureRadius`. The in-page probe reported globe altitude 7329 m at a game height of 2000 m, 5929 m at 600 m, and 5389 m at 60 m: the same +5329 m at every height. That is `R − figureRadius` along the home direction. `DETAIL` is off above 5000 m and `NEAR_SPLIT` is off above 3000 m, so both were off. `patchFade` is 0 at 2000 m, so the frame is only that globe. The atmosphere's `uRp` is the mean radius, so the path under that sphere is treated as sea-level air and the view washes out. The 2 km capture also had 5 tiles and chunks not ready; waiting alone does not remove the 5329 m error.
- **600 m flat and blocky.** Same +5329 m. Reported altitude 5929 m, so near-split and detail stay off. The forest patch disc is 80 m, and the isometric pitch looks past it, so the frame is coarse globe facets.
- **Dark bar.** Screen-locked, not a horizon. On `600m.png` and `60m.png` the flat strip is y=332–367, widest 980 px (x=60–1039), about 13 colours near `#0d131e`, standard deviation under 2. The same outline is on `2km.png`, and its shadow continues below y=367. That is `.padm`: `width:min(980px, 92vw)`, `top:50%` with `translate(-50%,-50%)`, padding 18+18 px, background `#0d131ef2`, radius 16. `.padm { display:flex }` overrides the browser `[hidden]` rule, so the closed empty menu stays visible. The flight prompt is the separate 550 px box at about y=293–331. It is not this bar.

### Change

- Radial term of `gameToPlanet` / `planetToGame` is `figureRadius`. East/north stay on the mean radius.
- `atmos.update` takes the drawn surface (`R + ground` from `globeView`) and sets `uRp` / `uRa` from it. The dome mesh is unchanged.
- `.padm[hidden]{display:none}`.

### Descent picture, measured again (2026-10-26 18:35 PT)

Sitting the camera on the figure removed the +5329 m and the washed-out 2 km frame. It did not refine the mesh. Two further measurements on the same still path (`?start=globe&stages=1&trees=v2&noprobe&inpagedev`, swiftshader, tier 5 Minimum, `lod.split` 0.55):

- The near-split gate compared the camera with the node centre. At 600 m the closest drawn level-7 cell had its centre 44.6 km away and an edge of 78 km. `alt × reach` was 2.4 km, so the boost (`nearK` 1.2) never applied. `splitDepth` stayed 6. The old centre test on that corner stops at level 7 (105 leaves). The footprint test reaches level 13 or deeper.
- Once the footprint test was in, the draw cap (`splitK` down to 0.35) multiplied the same factor. The 44.6 km centre needs `splitK` above about 0.47 or the cell collapses back to one leaf. The cap is for the far field. `splitWanted` applies the boost to the tier split and leaves `splitK` on nodes the camera is not over.

Swiftshader selects Minimum (`tierForGpu`). That row is 16 segments, detail strength 0, max level 15. The stills are that tier, at its own depth, not a second mesh.

| Frame | Probe |
| --- | --- |
| `orbit.png` | globe, altitude 14,016,219 m, elevation −90°, 17 tiles, deepest 1, pad `display:none` |
| `10km.png` | globe, altitude 10,000 m, elevation −90°, 51 tiles, deepest 7. Near split is off above 3 km |
| `2km.png` | band, height 2000 m, altitude 2000.05 m, elevation −35.264°, fade 0, deepest 13, 145 tiles, pad hidden |
| `600m.png` | height 600 m, altitude 600.05 m, fade 1, deepest 15 (edge 305 m), 202 tiles, pad hidden |
| `100m.png` | height 100 m, altitude 100.05 m, fade 1, deepest 15, 220 tiles, pad hidden |
| `ground.png` | height 1 m, altitude 1.05 m, fade 1, deepest 15, 190 tiles, pad hidden |

Files: `tasks/evidence/T-0096/`. Copies: `/opt/cursor/artifacts/orbit.png`, `10km.png`, `2km.png`, `600m.png`, `100m.png`, `ground.png`. `descent.json` is the probe.

`npx tsc --noEmit` exit 0. `npm test` 844 tests, 830 pass, 0 fail, 14 todo (2026-10-26 18:35 PT). The board line "not ok 723" is the existing todo, not a failure.

### Next step at 18:35 PT

Grokbot-1 reviews pull request #143. That was the step before the polygon and floor pass below.

## Polygons and the floor (2026-10-26 19:46 PT)

This run stays on `grokbot-3/one-viewpoint` and pull request #143. Not claimed. Not self-approved. Not merged.

Rule 15 at 2026-10-26 19:46 PT: `gh pr list` open PRs are 148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 137. Every head is a `grokbot-3/` branch. None were written by another agent, so none are reviewed or approved here. `grokbot-3/level-view` (PR #147, T-0101) owns `positionCamera` in `src/render/math.ts`. This pass does not edit that file. grokbot-2 is offline until about Oct 28 midday PT and is not tagged.

### What the dark shapes were

On the committed 2 km still (`git show HEAD:tasks/evidence/T-0096/2km.png`, 1100×700) a dark-pixel count (y 300–650, r+g+b < 55, max channel < 28, blue at least red and green) found 59,149 pixels. Those pixels are vertex-field lakes (`vLake` high, home mask `hm` 0) coloured with `lakeDeep`. The edges are triangle edges. They are not the pad menu, not cloud shadows (Minimum draws none), and not holes to space.

A fade keyed on segment size does not catch them once the cell under the camera is fine: at level 13 a segment is about 76 m and only a few pixels, while the lake body is many of those triangles. A uniform written per tile in `onBeforeRender` also fails. Three.js uploads a `MeshStandardMaterial` once per material per frame, so every tile saw the first tile's value.

`LAKE_FADE.uHide` is set once in `renderTo`, before `renderer.render`: 1 when globe altitude is under 8000 m, else 0. The fragment mixes the land colour over a vertex lake when the home mask is off. The home shoreline mask still draws. Oceans (`vLake` 0) stay. Orbit and 10 km stay above the gate.

### What the ground frame was

At 1 m the drone was still at the isometric pitch (−35.264°), so the eye looked into the ground a couple of metres ahead and into the nearest trunk. The flat teal is the far-layer atmosphere where the forest is missed (the eye is inside the stem; backfaces are culled). The grey stripes are the bark plate shader (`conifer.ts`, `fract(pl * 3)` on bark `0x6b5a4a`), seen from inside. Needles are `0x8eb054`. The bark shader is unchanged.

`descentPitch` changes only the drawn pitch, and only on the way down, from 48 m down to the 8 m floor. At 100 m and above the drawn pitch stays isometric. At the floor it is the existing horizon tilt (−0.18 rad, −10.313°). The stored stick pitch is unchanged. The climb still uses `globePitch`. Roll stays 0 in `viewpointPose`.

`eyeClearOfTrees` shifts only the rendered eye below 18 m, 1.6 m clear of a stem. It does not write the flight spot and it does not move the wolf spawn.

### Number table (this pass)

These are game clearances, not new physical constants. The horizon tilt and the isometric pitch were already in the flight.

| Value | Game | Why | Source | Match |
| --- | --- | --- | --- | --- |
| Lake hide | altitude under 8000 m | 10 km keeps far lakes; 2 km hides the polygons | `COARSE_LAKE.below` | game calibration |
| Floor look start | 48 m | 100 m stays isometric | `FLOOR_LOOK.high` | game calibration |
| Floor pitch | −0.18 rad (−10.313°) | the climb's horizon already | `HORIZON_TILT.horizon` | yes, not new |
| Eye clearance | below 18 m, gap 1.6 m | stem dbh 15–25 cm; near plane at 1 m is 0.2 m | `EYE_CLEAR` | game calibration |
| Roll | 0 | `Euler(pitch, yaw, 0, 'YXZ')` | `viewpointPose` | yes, not new |

### Frames (2026-10-26 19:45 PT)

`node tasks/evidence/T-0096/capture-descent.mjs 5275 tasks/evidence/T-0096`. Headless Chrome, swiftshader, tier 5, `?start=globe&stages=1&trees=v2&noprobe&inpagedev`. The machine was idle (the earlier 2 km timeout was a capture that ran during `npm test`). Dark-pixel count on the new `2km.png`: 0, against 59,149 on the committed still. 33.7% of pixels changed. Orbit blue-water fraction stayed 0.182 (0.18177 before, 0.18177 after). Ground row means drop from about (211, 205, 180) at y=180 to (95, 95, 70) at y=200, then green below: sky above the horizon, forest floor under it.

| Frame | Probe |
| --- | --- |
| `orbit.png` | globe, altitude 14,016,219 m, elevation −90°, 17 tiles, deepest 1, queued 0, pad `display:none` |
| `10km.png` | globe, altitude 10,000 m, elevation −90°, 51 tiles, deepest 7, queued 0 |
| `2km.png` | band, height 2000 m, altitude 2000.05 m, elevation −35.264°, fade 0, deepest 13, 145 tiles, queued 0 |
| `600m.png` | height 600 m, altitude 600.05 m, elevation −35.264°, fade 1, deepest 15, 202 tiles, queued 0 |
| `100m.png` | height 100 m, altitude 100.05 m, elevation −35.264°, fade 1, deepest 15, 220 tiles, queued 0 |
| `ground.png` | height 1 m, altitude 1.05 m, elevation −10.313°, fade 1, deepest 15, 190 tiles, queued 0 |

Files: `tasks/evidence/T-0096/`. Copies: `/opt/cursor/artifacts/orbit.png`, `10km.png`, `2km.png`, `600m.png`, `100m.png`, `ground.png`. `descent.json` is the probe.

`npx tsc --noEmit` exit 0 (2026-10-26 19:46 PT). `npm test` 846 tests, 832 pass, 0 fail, 14 todo (2026-10-26 19:50 PT). The new checks are `coarseLake` (orbit and 10 km keep a vertex lake, 2 km hides it, the home mask and the ocean stay) and the floor pose (100 m stays isometric, 1 m is the horizon, roll 0, the eye steps off a stem). GitHub `ci / test` on this private repo still fails in a few seconds with no steps because of the org billing limit. That is not a pass. Local `npm test` is the run that executed.

### Exact next step

Recapture the six stills on this landing and full-resolution far layer, and read them before asking for review. grokbot-3 does not approve or merge. grokbot-2 is not tagged.

## 2026-10-26 20:17 PT — the floor was the lake, and 2 km was a half-resolution far layer

The stills on `3e8a467` are not showable. This pass changes the landing and the far-layer size. The new stills are not in yet.

### What the old stills were

`ground.png` is the game water sheet. A double-click on the centre of the home region samples (0, 0). `surfaceAt(0, 0)` is an open lake (height about −1.65 m). `descend` stood there. The camera sits about a metre above that sheet, so the frame is flat teal, one shore spruce (bark plates `0x6b5a4a`, `fract(pl * 3)`), and a pale ring of grazing specular on the flat water. Replacing the far layer with magenta leaves the teal, so it is not the atmosphere and not a missing forest renderer. `eyeClearOfTrees` does not find a stem in the middle of the lake, so it does not move the eye.

The wolf view (`tasks/evidence/T-0101/after-kenora.png` on `grokbot-3/level-view`) stands at about (30, 0). `landSpawn({ x: 0, z: 0 })` is that same dry-stand step the reload handoff already uses. `descend` now calls it once, with the fall's yaw, and places the player there. Roll stays 0. `positionCamera` is not edited.

`2km.png` is only the far layer: patch fade is 0 at the band top. The far layer default is half resolution (550×350 stretched to 1100×700). The home shore mask is 1024² over 7680 m. Its fragment keeps the mask only while the texel footprint is under `smoothstep(1.5, 4)`. Half resolution doubles that footprint, the mask drops out, and `uHideLake` (on under 8000 m) paints vertex lakes as land. The frame is a green wash. 10 km is full-framebuffer globe mode with `uHideLake` off. 600 m is close enough, and the patch is in, so it still reads. While fade is under 0.5 the far layer is drawn at scale 1, then returned to 0.5 once the patch covers the frame. The default byte budget is unchanged.

Below 60 m (`INPAGE.hazeLow`) the globe occlusion margin is 1e6 m, so the coarse globe cannot replace the forest floor. At 100 m and above the old margin `[15 m, 0.03 × distance]` stays. No new physical constant.

### Number table

| Value | Game | Why | Source | Match |
| --- | --- | --- | --- | --- |
| Dry stand | nearest dry land within 900 m | the clicked centre is the lake | existing `landSpawn` | yes, not new |
| Far layer while the patch is out | scale 1 | half resolution washes the shore mask | `far.setScale`, fade under 0.5 | game calibration |
| Far layer once the patch is in | scale 0.5 | the shared-mode budget, sky only | `createFarLayer` default | yes, not new |
| Floor occlusion | 1e6 m below 60 m | the globe must not hide the stand | `nearGroundOcc`, existing `hazeLow` | game calibration |
| Roll | 0 | `Euler(pitch, yaw, 0, 'YXZ')` | `viewpointPose` | yes, not new |

### What the first recapture showed (2026-10-26 20:24 PT)

The camera does stand at (30, 0), height 1 m, on dry clay. The 2 km far layer was scale 1 but only 550×350, because Minimum draws into a half-size buffer (`resScale` 0.5) and the shore mask was already loaded (`maskReady` true). Half the window is still past the mask cutoff, so the frame stayed a green wash. The floor had `borealTreesV2` variants 0 the whole time the queue was flora, chunk, grass and moss. `trees2:build` at priority 55 never took a slice, so no spruce mesh was drawn.

The far layer is now the window size while the patch is out, and the conifer build runs at priority 4 (after the chunk under the camera, before grass). Stills of that are next.

### Exact next step

Recapture and read the six stills. GitHub `ci` remains billing-blocked and is not a pass. grokbot-3 does not approve or merge. grokbot-2 is not tagged.

## Needs from another agent

Grokbot-1: review pull request #143. grokbot-2 is offline until about Oct 28 midday PT and is not tagged. grokbot-3 does not approve this work.

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

### Exact next step

Grokbot-1 reviews pull request #143. grokbot-3 does not approve or merge. grokbot-2 is offline until about Oct 28 midday PT and is not tagged.

## Needs from another agent

Grokbot-1: review pull request #143. grokbot-2 is offline until about Oct 28 midday PT and is not tagged. grokbot-3 does not approve this work.

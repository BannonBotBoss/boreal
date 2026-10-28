# T-0108 handoff (grokbot-3)

Branch: `grokbot-3/globe-to-animals`. Issue #156. Lane: bridge, plus the animal picture already in progress (issue #158). Blitz mode is #157: grokbot-3 merges this once `npx tsc --noEmit` and `npm test` pass, and says so. Grokbot-1 is tagged on the change. grokbot-2 is not tagged.

## Why a far click showed the wolf's forest

`sampleSurface` writes game x and z only inside the Kenora home square (half-size 3,840 m). Elsewhere they stay 0. `descend` then calls `landSpawn` on those coordinates, so every off-home double-click woke up on the wolf's lake. Chunks, `planet.fromLocal` (the weather read), and `plantsGrowAt` (fixed at 49.77 N) all live in that one frame. The origin bus is unused. The globe outside that square is only the planet mesh.

## What was built

- The fall still ends at 10,000 ft and still uses `stepCarriedFly`. It now carries the clicked direction. Off the home square, `engageLanding` anchors the existing frame on that direction: height is the planet sample the tiles already use, weather uses that direction, and the tree line uses that latitude. Home (`home > 0`) does not move.
- The carried fall stops at 400 m unless the player is flying down. The vertical speed becomes an 8 m/s glide. The clouds are the shell (2.5 km) and the local box (top 12 km) already in the sky. The fall crosses the local box; the drone continues under the shell.
- Animals already placed by the chunk generator and the hare adapter fade from a fixed-size speck, to a low body, to a full model. `setBodyShare` still runs after `density.sync`. The old disc stays off near the ground, so it cannot become a dome.
- Gray Wolf loads `public/models/animals/wolf.glb` (26,033 triangles, 1,024² textures, 1.94 MB) and `wolf-low.glb` (simplify stopped at 18,193 triangles, 1.42 MB). Scaled to the 0.74 m shoulder row. Head −X is turned to game −Z. Still or far, the mesh is rigid. Close and moving keeps the procedural bones. Deer and hare have no file, so they stay procedural. Fur cards drop on the low step.
- Above the tree line at the site latitude, deer, spruce, and hares are not placed. That is the existing `plantsGrowAt`, not a new range map.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Glide height | 400 m | [game calibration] Between #107's 100 m and 1 km stations | labelled calibration |
| Full / low / speck | 16 / 48 / 140 m | [game calibration] | labelled calibration |
| Glide | 8 m/s | [game calibration] Between photo fly 6 and 25 m/s | labelled calibration |
| Fall handoff | 3,048 m | 10,000 × 0.3048 m, NIST SP 811 | yes |
| Clouds | 2.5 km shell, 12 km local top | Existing `CLOUDS` and `LOCAL_CLOUDS` | reused |
| Wolf shoulder | 0.74 m | Species row already shipped (plan cites 80–85 cm) | reused |
| Wolf file | 26,033 tris, 1.94 MB; low 18,193 tris, 1.42 MB | Measured with gltf-transform inspect. Simplify did not reach ~2,000 triangles | measured |

## Frames

Headless Chrome, `tasks/evidence/T-0108/capture.mjs`, after `placeAt` (the same descend). The picture counter is in `frames.json`.

| Still | What is on screen |
| --- | --- |
| `home-glide.png` | 400 m over the home shore. A steep look. The forest patch is in the lower frame with small orange specks (the counter says 6). The rest of the frame is the globe. The glide line is on screen. |
| `home-low.png` | 36 m. Pale animal bodies on the grass by the lake. No dome. |
| `home-wolf.png` | 7 m on the same shore. Hares read as small bodies. The counter reports one full wolf mesh (`fulls: 1`). It is not a clear portrait. |
| `boreal-glide.png` | 55 N, 400 m. A local ground patch with specks, set in the globe. |
| `prairie-glide.png` | 42 N, 400 m. The same kind of local patch and specks. |

The drone-photo resemblance is not a calibrated 95% score. These frames do not look like a photograph of countryside. Grokbot-1 owns that landscape. This handoff does not claim that score.

## Needs from another agent

- Biological back end: species ranges and densities per place. This change only moves the frame and hides forest animals above the tree line.
- Grokbot-1: terrain, plants, and light at a remote landing so the glide looks like a drone photo.
- A later model drop: white-tailed deer and snowshoe hare, requested in the `3D request` issue. Until those files are in the manifest, the procedural bodies stay.

## Leftovers

- The low wolf is still 18,193 triangles. The instance cap is 8.
- Skinning the GLB onto the wolf bones is not done. Motion close-up is the procedural body.
- The stage grid is not a second world. Off home, the broad shape is the planet sample plus the existing `surfaceDetail`. Soils and stands off home are not a new biome map.

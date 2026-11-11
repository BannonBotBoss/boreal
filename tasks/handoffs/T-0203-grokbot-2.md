# T-0203 handoff (grokbot-2)

## What this is

D23. One chunked-LOD terrain mesh replaces the chunk plates and the horizon skirt. Branch `grokbot-2/continuous-terrain`.

## Done

- `src/render/continuousTerrain.ts`: restricted quadtree, skirts, `heightAt` minus `curvatureDrop`, one mesh.
- `buildScene.ts`: skirt not added, chunk grounds `visible = false`, camera far past the horizon.
- Tests: `tests/continuous-terrain.test.ts`, `tests/ground-picture.test.ts`.
- Frames under `tasks/evidence/T-0203/`. Same URL and pose before and after. SwiftShader, 1280×720. After mesh: eye 40 had 340 leaves, outer 46 km, 65280 triangles.

## What the frames show

- Before, eye 40: floating plates, gaps, a flat tan plane, a hard blue horizon, a pale sky.
- After, eye 40: one rolling surface to the horizon. No plates, no tan plane, no sky showing through the ground. The horizon is still a hard line and the sky is still pale. That is D19/D22, not this task.
- Before, standing: tan plane beyond the near ground, hard blue band.
- After, standing: continuous ground under the wolf. No tan plane. Horizon still hard.

## Numbers

| value | game | source | match |
|---|---|---|---|
| Horizon at 40 m | `horizonMetres` ≈ 22.6 km, mesh outer 46 km (root corner) | sqrt(2 R h + h²), R = IUGG mean radius | yes |
| LOD split | distance < size / 0.72 | Ulrich 2002 screen-space split, eye height in the distance | yes, calibration of 0.72 |
| Skirt | max(8 m, 0.35 × leaf) | Proland / Ulrich crack fill | yes, calibration of the fraction |
| Grid | 8 × 8 quads a leaf | one LOD cell, not a second ring | yes |

## Picture check

Tan pixels in the ground window (y 0.48–0.70, x 0.28–0.78): R > G > B, R − B > 25, R in (90, 190).

| frame | tan share | gate (< 0.04) |
|---|---|---|
| before-eye40 | 0.209 | fail (known mismatch) |
| before-stand | 0.297 | fail (known mismatch) |
| after-eye40 | 0.001 | pass |
| after-stand | 0 | pass |

Tool: `tests/ground-picture.test.ts` (pngjs).

## How to verify

`npx tsx --test tests/continuous-terrain.test.ts tests/ground-picture.test.ts`

Open `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. `window.__terrain.outerM` should exceed the horizon. The skirt mesh is not in the scene.

## Next

D19/D22: the far edge of this mesh should fade with aerial perspective. Do not put the skirt back. A rebuild is about 0.9 s at eye 40 (about 350 leaves) and snaps every 24 m.

## Needs from another agent

None.

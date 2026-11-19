# T-0261 handoff (grokbot-2)

## What this is

The globe descent stalls at the 400 m glide and while the dive is held. `setEye` writes the reported height before the frame is drawn, and the horizon mesh was rebuilt synchronously inside that draw, so the canvas stayed on the previous picture. Branch `grokbot-2/descent-stall`. Draft PR #507. Do not mark it ready. Filed as T-0259, then renumbered to T-0261 because PR #504 already has T-0259 and PR #508 has T-0260.

## Root cause

`createContinuousTerrain().update` called `buildContinuousMesh` on the main thread whenever `round(log2(eye) * 4)` changed, then assigned the whole buffer for upload in that same call.

| suspect | measured on main 6af1de2e | verdict |
|---|---|---|
| Synchronous horizon mesh | node: 371–560 ms, 2.05–3.10 MB. Eye 400 m: 560 ms, 304 leaves, 58,368 triangles, 2.55 MB. SwiftShader page, 1280×720: worst dive frame 477 ms (eye 416 m). About 40 log-height bands from 2 km to 2 m. | root cause |
| Chunk uploads | `CHUNK_ADDS_PER_FRAME` is 2. Chunk jobs already yield. Chunk ground is not drawn. | not the multi-second gap |
| Texture uploads | Sentinel and DEM decode off the draw. The cloud bake is 192 KB and only after a quarter-box move. | not the multi-second gap |

## What was built

- A coarse 8×8 placeholder covering the horizon square is swapped in on the frame the eye band changes (`chunkAction` refuses an empty swap).
- Finer leaves build nearest-first for at most `TERRAIN_BUILD_MS` (8 ms) and upload at most `TERRAIN_UPLOAD_BYTES` (256 KB) as one new mesh. The placeholder stays until those leaves cover the root.
- The terrain shader is still `continuousMaterial`, which already uses `GLSL_NOISE` from `proc/glsl.ts`. No new noise library.
- `performance.now` in the slice and in the SwiftShader page is on the frame-budget allowlist, same as `render/batch.ts`.

## How to verify

- `npm test` includes `tests/descent-frame.test.ts`.
- `npm run test:slow` includes `tests/slow/descent-swiftshader.test.ts` (Chrome, `--use-angle=swiftshader`).
- Page: `descent-frame.html`. Pose is `viewpointPose` at `ISO_BELOW_HORIZON`.

## Numbers

| value | game | real / source | match |
|---|---|---|---|
| Frame slice | 8 ms | a slice of a 16.7 ms frame; `INTEREST.budgetMs` is 4 ms (`src/core/interest.ts`) | yes, calibration |
| Upload budget | 256 KB | one leaf is about 8 KB; the whole mesh was 2.05–3.10 MB | yes |
| Gate | 250 ms | the stall capture peaks at 477 ms, so a 500 ms line lets it pass; 250 ms fails that file and passes the 96.9 ms streamed capture | the review on PR #507 |
| Horizon | `horizonMetres` | sqrt(2 R h + h²), R the IUGG mean radius | yes |
| LOD split | 0.72, unchanged | Ulrich 2002, eye height in the distance | yes |
| Coarse grid | 8×8 on the horizon square | the same quad count as one fine leaf (`TERRAIN_GRID`) | yes |
| SwiftShader before | worst frame 477.4 ms | `tasks/evidence/T-0261/before.json`, renderer SwiftShader | the stall |
| SwiftShader after | worst frame 96.9 ms, settled shots 4–7 ms | `tasks/evidence/T-0261/after.json`, same renderer | under 500 ms |

## Frames

SwiftShader, 1280×720. What I see:

- `before-1200m.jpg`: a pale green plain, the mottling small, the horizon high. Mean of the centre crop 471. Hash `1d7d7130`. The rebuild for that band took 236 ms.
- `before-300m.jpg`: the same plain, the mottling larger. Mean 378. Hash `ffe32fe6`. 294 ms.
- `before-28m.jpg`: olive ridges and a valley filling the frame. Mean 302. Hash `330b19a4`. 247 ms. This is not the 1200 m picture.
- `after-1200m.jpg`: a green plain with the shared shader grain, horizon high. Hash `58ab2443`. The settled frame was 4.2 ms. The worst dive frame was 96.9 ms.
- `after-300m.jpg`: the grain reads larger, the ground closer. Hash `d8b011f6`. Settled frame 6.8 ms.
- `after-28m.jpg`: the same ridges and valley as the before frame at 28 m. Hash `7daca185`. Settled frame 6.9 ms.

The three after hashes differ. A second raster of the same settled eye differs by 0 (`tests/descent-frame.test.ts`). 1200 m against 300 m differs by about 0.06 and against 28 m by about 0.11 (linear colour, gate 0.03).

Picture check: the gate is that raster, not an eyeball. N/A for a natural-history resemblance score: these frames are the mesh timing, not a claim that the boreal looks like a photograph.

## Needs from another agent

- None. The PR stays a draft.

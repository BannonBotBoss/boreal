---
id: T-0261
title: Descent stall — stream the horizon mesh
author: grokbot-2
scratch: false
research: true
skill: continuous-terrain-lod
tags: [visual]
credits: 39
---
# T-0261 Descent stall

Matthew, 2026-11-18 15:20 PT, asked for the descent stall found on main `6af1de2e` to be fixed, the pull request opened as a draft, and it never marked ready by the author. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x 1.3. Not from scratch. The chunked LOD, the terrain worker, and the per-frame chunk-add cap were already in the repo. Research is the profile that separated the stall from chunk adds and texture uploads.

Filed first as T-0259 on this branch. PR #504 already uses T-0259 for the standing-sky cloud. PR #508 has T-0260. #492 is T-0256 and #490 is T-0222. This work is T-0261. The events exist only on this unmerged branch, so they were renumbered with the task. The comment event names the old id and does not change state.

## Objectives

- [x] The horizon mesh follows the eye on the frame the height changes. A coarse placeholder is drawn that frame. Finer leaves are built in a time slice and uploaded a budget at a time. `src/render/continuousTerrain.ts`.
- [x] A dive from 2000 m to 2 m fails if any frame gap exceeds 500 ms, or if the picture at 1200 m, 300 m and 28 m does not change with height. `tests/descent-frame.test.ts` and `tests/slow/descent-swiftshader.test.ts`.
- [x] Before and after frames at 1200 m, 300 m and 28 m are in `tasks/evidence/T-0261/`. SwiftShader, 1280×720.

## Profile (main 6af1de2e, node, same `heightAt` the mesh uses)

| suspect | measured | verdict |
|---|---|---|
| Synchronous horizon mesh | `buildContinuousMesh` 371–560 ms, 2.05–3.10 MB of vertex attributes assigned in that call. Eye 400 m: 560 ms, 304 leaves, 58,368 triangles, 2.55 MB. A dive crosses about 40 log-height bands (`round(log2(eye) * 4)`), so holding the dive stacks those stalls. | root cause |
| Chunk uploads | `CHUNK_ADDS_PER_FRAME` is 2. Chunk jobs already yield. The chunk ground mesh is not drawn. | not the multi-second gap |
| Texture uploads | Sentinel and DEM tiles decode off the draw. The cloud bake is 192 KB and only when the camera moves a quarter box. | not the multi-second gap |

`setEye` writes the reported height before `draw` reaches `post.render`. The rebuild sits in that draw, so the canvas stays on the previous picture until the rebuild returns.

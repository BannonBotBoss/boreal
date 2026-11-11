---
id: T-0203
title: One terrain mesh to the horizon
author: grokbot-2
scratch: true
research: true
skill: continuous-terrain-lod
tags: [visual]
credits: 54
---
# T-0203 One terrain mesh to the horizon

Matthew, 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, 2026-11-07: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 54 = 10 x 3 objectives x (1 + 0.5 from scratch + 0.3 research).

D23. The 40 m eye showed separate chunk plates on a flat brown plane, with sky in the gaps. PR #428 added a CDLOD far ring and did not remove that. This task removes the far ring and the chunk plates and draws one chunked LOD (Ulrich 2002, skirts as in Proland) sampled from `heightAt`.

The hard pale horizon and the washed sky are D19/D22. They are not claimed here.

## Objectives

- [x] The ground view draws one terrain mesh from the camera past the geometric horizon. The horizon skirt is not in the scene. Chunk ground meshes are not drawn.
- [x] Surface vertices match `heightAt` minus earth curvature, leaves tile one square, and a skirt covers each LOD edge. `tests/continuous-terrain.test.ts`.
- [x] The same pose before and after, with a picture check that fails the before frames and passes the after. `tests/ground-picture.test.ts`.

## Acceptance

URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40` and the same without `eye` (standing height). SwiftShader, 1280×720.

| frame | what it shows |
|---|---|
| `tasks/evidence/T-0203/before-eye40.png` | Separate green plates, gaps, a flat tan plane, a hard blue horizon, a pale sky. |
| `tasks/evidence/T-0203/after-eye40.png` | One rolling green-brown surface out to the horizon. No plates, no tan plane, no sky in the ground. The horizon line is still hard and the sky is still pale. |
| `tasks/evidence/T-0203/before-stand.png` | Mottled ground near the feet, then a flat tan plane and a hard blue band. |
| `tasks/evidence/T-0203/after-stand.png` | Continuous dark ground under the wolf and the trees, out to a still-hard horizon. No tan plane. |

Tan share of the ground window: before 0.209 and 0.297, after 0.001 and 0. The test fails a share above 0.04.

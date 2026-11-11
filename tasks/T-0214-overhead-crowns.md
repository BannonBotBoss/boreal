---
id: T-0214
title: Overhead crowns from the stand placement
author: grokbot-2
scratch: false
research: true
skill: overhead-crowns
tags: [visual]
credits: 39
---
# T-0214 Overhead crowns from the stand placement

Matthew, 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, 2026-11-07: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: `farTreesInTile` and the globe nadir already exist.

D24. PR #429 painted a NAIP texture and the 400 m and 800 m views stayed a noise field. The first impostor pass on this branch was identical black dots inside a circle. This pass bakes a lit top-down billboard of the existing spruce mid-LOD (three seeds). The octahedral shader does not compile here (`unpackRGBToNormal`). The tiled canopy under the billboards is replaced by a smooth litter and moss floor.

## Objectives

- [x] Nadir crowns are billboards baked from `buildConifer`, placed from `farTreesInTile` across the view rectangle, faded at the frame edge. `tests/overhead-crowns.test.ts`.
- [x] They sit on the visible surface, in the camera-relative frame the tiles use, with a ground shadow. The tiled canopy is off while they draw.
- [x] Same pose before and after at 400 m and 800 m. The picture check fails the bright noise and passes the darker floor. `tests/overhead-picture.test.ts`.

## Acceptance

URL `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` with `alt=400` and `alt=800`. SwiftShader, 1280×720. The point is boreal (cover sample: share 1).

| frame | what it shows |
|---|---|
| `before-400.png` | Green and brown tile noise across the whole frame. Median green 89. No crown you can point at. |
| `after-400.png` | Clusters of rounded spruce crowns, bright in the middle and dark at the rim, with soft shadows. They touch inside the clusters and leave olive gaps. The floor is smooth, not the tiled noise. They thin toward the edges of the frame. Median green 35. They are three baked shapes repeated, not the NAIP photograph. |
| `before-800.png` | The same noise. Median green 83. |
| `after-800.png` | The same crowns, smaller and more separated. Clusters and gaps remain. The floor is smooth. Median green 37. |

Median green of the centre window: before above 70, after under 55.

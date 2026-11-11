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

D24. PR #429 painted a NAIP texture and the views stayed a noise field. Identical discs in a circle were rejected. An octahedral impostor of the whole spruce, stood on the radial, turns into streaks that point at the nadir. These frames are lit top-down billboards of that spruce's foliage, three seeds, on a smooth floor.

## Objectives

- [x] Nadir crowns are billboards baked from `buildConifer`, placed from `farTreesInTile`. Fade is world distance past the view corner, not the screen rectangle. `tests/overhead-crowns.test.ts`.
- [x] They sit on the visible surface, in the camera-relative frame the tiles use. The shadow is offset away from the sun. The tiled canopy is off while they draw, and the gaps are a mid-tone moss and litter colour.
- [x] Same pose before and after at 400 m and 800 m. The picture check fails the noise (almost no bright crowns at the top edge) and passes crowns that reach that edge. `tests/overhead-picture.test.ts`.

## Acceptance

URL `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` with `alt=400` and `alt=800`. SwiftShader, 1280×720. The point is boreal (cover sample: share 1).

| frame | what it shows |
|---|---|
| `before-400.png` | Green and brown tile noise across the whole frame. Median green 89. No crown you can point at. |
| `after-400.png` | Rounded crowns in two hues, dark blue-green and yellow-green, with a size spread. Clusters touch and close into patches. A darker side sits off each crown, toward the lower left, and there is no black ring. Gaps are a muted olive, not near-black. The field reaches the frame edge. Still rounder and more even than the NAIP crop. |
| `before-800.png` | The same noise. Median green 83. |
| `after-800.png` | The same crowns, smaller. More of the olive floor shows, so patches are less closed than at 400 m. The instance cap is 24000. No black ring, no frame-shaped fade. The floor in the gaps is about sRGB (85, 114, 77), near the NAIP gap. |

Bright crown share (g > 120 and g > r + 15) at the top of the frame: the noise is under 0.08, the billboards stay above 0.45 and within a quarter of the centre.

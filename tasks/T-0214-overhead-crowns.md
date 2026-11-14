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
- [x] Same pose before and after at 400 m and 800 m. The picture check compares HSV mean and sd to the NAIP crop and fails the lime carpet. `tests/overhead-picture.test.ts`.

## Acceptance

URL `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` with `alt=400` and `alt=800`. SwiftShader, 1280×720. The point is boreal (cover sample: share 1).

| frame | what it shows |
|---|---|
| `before-400.png` | Green and brown tile noise across the whole frame. Median green 89. No crown you can point at. |
| `after-400.png` | Not the lime carpet. The ground is muted olive and tan, and it shows between the trees. The trees are small dark-green marks, many of them a star or cross from the spruce cards seen from above, with a lighter middle and a darker edge. They are not the NAIP crowns: no resolved needle clumps, and the same few shapes repeat. HSV mean/sd sits inside the NAIP tolerance. |
| `before-800.png` | The same noise. Median green 83. |
| `after-800.png` | The same ground and the same small marks, smaller on screen, with more ground between them. 9783 crowns. Same colour statistics. |

Picture check: HSV mean and standard deviation of the frame against `tasks/evidence/T-0199/ref-naip-canopy.png`. The lime carpet (saturation 0.70 against 0.285) fails. Tolerance is hue mean 10°, hue sd 7°, saturation mean 0.07, saturation sd 0.04, value mean 0.06, value sd 0.04.

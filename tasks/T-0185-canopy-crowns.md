---
id: T-0185
title: Boreal from a few hundred metres shows crowns
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0185 Boreal from a few hundred metres shows crowns

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the stand mosaic is already there. The 12 m cell is between one crown and the Sentinel-2 10 m pixel.

At 52 N, 97 W the game reports boreal, vegetation about 0.93, day 227, morning, sun about 35°. The 400 m picture was a smooth green. Sentinel-2 cloudless boreal is a stipple of crowns inside the stands.

## Objectives

- [x] Vegetated land breaks into 12 m crown clumps, widened when a pixel is coarser than that, on the globe tiles and the skirt.
- [x] The clump is darker at the gap and brighter on the crown, and the mean stays near the albedo (the bright end is 1.28, not 1.4).
- [x] `tests/crown-cover.test.ts` fails on the smooth 400 m frames and passes on the after globe. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0185/before-globe-400.png` (4 px step 0.21) and `before-drone-400.png` (0.48). After: `after-globe-400.png` (step 2.22).

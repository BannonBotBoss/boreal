---
id: T-0187
title: Overhead boreal is daylight green, not black red noise
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0187 Overhead boreal is daylight green, not black red noise

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the stand field already exists. The colours are retuned to the globe's sun, not to raw MODIS reflectance.

T-0184 and T-0185 raised luma spread. The frames stayed almost black (mean luma 19.7 at 2000 m, 24 at 400 m) with red fen patches and, at 400 m, a wallpaper of dots. A variance test passed that noise.

## Objectives

- [x] At 2000 m and 400 m the boreal is mid-dark green stands in the EOX Sentinel-2 band, not a black red field and not a dot grid.
- [x] Open water (height below its level) is not forced to land in that aerial band. `aLake` is not used as a water mask.
- [x] `tests/overhead-stand.test.ts` fails the T-0184 frame and passes the new frames by colour against the EOX tile, not by luma spread. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0187/before-globe-2000.png` (the T-0184 after frame) and `before-globe-400.png` (the T-0185 after frame). After: `after-globe-2000.png`, `after-globe-400.png`. Reference: `ref-eox-z8.png`. Same `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227`, altitudes 2000 and 400, tier 5 (SwiftShader).

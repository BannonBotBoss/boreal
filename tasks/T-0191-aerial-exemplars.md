---
id: T-0191
title: Aerial exemplars for the 400 to 2000 m ground
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0191 Aerial exemplars for the 400 to 2000 m ground

Direct request, 2026-11-09 15:30 PT: fix D17c. The ground from 400 to 2000 m has failed five passes. After #417 it looks like a camouflage print at 2000 m and green static at 400 m. Stop tweaking procedural shaders. Use real aerial exemplars blended by the biome weights, with Heitz and Deliot tiling-and-blending, and a hard shoreline from the height field. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the height field, the cover mixes, and the aerial band already exist.

## Objectives

- [x] At 400–2000 m the colour is a small set of real aerial exemplars (canopy, fen, shore, open water), blended by the existing cover weights, with Deliot and Heitz tiling-and-blending. Water is the height-field contour, not a punched navy disc.
- [x] Side-by-side frames at 2000 m and 400 m over 52.00 N, 97.00 W (seed 1400), plus a second 2000 m frame where the height field is under water, each next to `tasks/evidence/T-0189/ref-eox-z14.png` at the same metres per pixel, under `tasks/evidence/T-0191/`.
- [x] `tests/aerial-exemplar.test.ts` compares local-patch structure to that reference and fails the #417 frames `tasks/evidence/T-0189/after-globe-2000.png` and `after-globe-400.png`. The author does not approve the work.

## Acceptance

Same view as #417: `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400`, altitudes 2000 and 400. The game reports seed 1400, boreal, about 78 m. The exemplars are USGS NAIP samples of that biome near 48 N, not a map of this coordinate and not Kenora.

---
id: T-0199
title: The canopy exemplar is a 1024 px NAIP crop
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0199 The canopy exemplar is a 1024 px NAIP crop

Direct request, 2026-11-10 03:41 PT: D24. At 400 m and 800 m the overhead reads as pixel noise because the NAIP canopy exemplar is a 128 px crop at 1.6 m per pixel. Replace it with a larger public-domain NAIP crop of boreal canopy, at least 1024 px, and credit it. Keep the tiling and blending from #421. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the exemplars, the Deliot and Heitz sampler, and the cover weights already exist.

The tile cache of USGS Imagery Only stops at zoom 16 (level 17 is 404). NAIP on that service is about 1 m. The canopy is an export of 1024 px across 1024 m, centred near 48.094 N, 91.482 W. Fen, shore, and water stay the 128 px crops. The canopy has its own repeat so their world size does not change. The sampler is still `tbSample`.

## Objectives

- [x] Canopy is a public-domain NAIP crop of at least 1024 px, credited in `public/aerial/CREDITS.md`. Fen, shore, and water stay on the #421 repeat.
- [x] Side-by-side at 400 m and 800 m under `tasks/evidence/T-0199/`, next to the NAIP crop.
- [x] `tests/canopy-structure.test.ts` scores correlation 8 m away. A shuffle of the same pixels fails. The author does not approve the work.

## Acceptance

Overhead: `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400&alt=` 400 and 800. The before frames are the path inspection on main. The NAIP crop is the reference for crowns.

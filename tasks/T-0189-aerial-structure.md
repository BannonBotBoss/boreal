---
id: T-0189
title: Overhead boreal has crowns, fens and blue water
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0189 Overhead boreal has crowns, fens and blue water

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the aerial band and the stand table already exist.

T-0187 matched mean luma to an EOX Sentinel-2 zoom-8 tile (about 376 m per pixel at 52°). A 2000 m camera with a 45° lens and a 1280 px frame covers about 1.3 m per pixel. That frame stayed a dark green blur. This task judges it against a zoom-14 tile (about 6 m per pixel) of boreal shield, not against that zoom-8 crop and not against Kenora.

## Objectives

- [x] At 2000 m and 400 m the boreal shows crowns, a lighter deciduous patch, brown fen, and dark-blue water with a shore. It is not one smooth green.
- [x] A pond is camera-relative metres. The aerial blue is applied after the pond opens the land mask, so the pond is not the stored 0.01 albedo.
- [x] `tests/overhead-stand.test.ts` fails the T-0187 frames and passes the new frames on edge, water share, histogram peak and histogram distance against the zoom-14 tile. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0189/before-globe-2000.png` and `before-globe-400.png` (main `af2ccd98`, the same blur as T-0187). After: `after-globe-2000.png`, `after-globe-400.png`. Reference: `ref-eox-z14.png`. Same `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5`, altitudes 2000 and 400. The game reports seed 1400, 52.00 N, 97.00 W, day 227 (full leaf: phenology colour 0), boreal, elevation about 78 m.

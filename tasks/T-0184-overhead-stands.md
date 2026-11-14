---
id: T-0184
title: Overhead boreal is a stand field, not one olive quad
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0184 Overhead boreal is a stand field, not one olive quad

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the stand mosaic already exists. The colours stay in the MODIS boreal albedo range.

At 52 N, 97 W the game reports boreal, day 227, morning, sun about 35°. The globe at 2000 m was one soft dark fill (luma spread 2.35, 6 px step 0.81). The older overhead frame is flat olive with dark water polygons and square tile edges (`tasks/evidence/T-0183/overhead-2000.png`).

A vertex colour is one value across a coarse quad, so scaling it keeps the square. The overhead stand is only a function of world metres.

## Objectives

- [x] Overhead vegetated land mixes toward a continuous fen / conifer / leaf field, so a tile edge is not a square of one olive.
- [x] A coarse lake edge wanders a few metres, and the lake albedo is lifted off the near-black 0.01.
- [x] `tests/overhead-stand.test.ts` fails on the before globe and passes on the after globe. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0184/before-globe-2000.png`. After: `tasks/evidence/T-0184/after-globe-2000.png`, same `?view=globe&alt=2000&latlon=52,-97`. The boreal is separate stands, not one fill.

---
id: T-0215
title: An ocean drop is the sea, not a seeded ice mountain
author: grokbot-2
scratch: false
research: true
skill: coarse-bathymetry
tags: [visual]
credits: 26
---
# T-0215 An ocean drop is the sea, not a seeded ice mountain

Matthew, direct chat 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: `sampleSurface`, `surfaceRadius`, and the ocean branch in `landingSite.ts` already exist. T-0211 on PR #438 already names this picture, so this task takes the next free id above T-0214.

D28. After the globe drop the player stands at 8.487 N, 129.334 W. That pixel of the zoom-0 Mapzen terrarium (ETOPO1) is -4589 m. The HUD said ice, 5074 m, vegetation 0.92, and the ground was a clipped white sheet. `createPlanet(1400).sampleSurface` returns h = 5074.6 m, kind land, at that direction. `surfaceRadius` in `radial.ts` then lifts the surface by that mountain. The ice line at 8.5 N is 4633 m (`iceLineM`), so the class is ice.

## Objectives

- [ ] The landing at that aim is the sea surface: biome water, elevation 0, and the radius is the figure, not a 5074 m mountain. Open ocean stays on the aim.
- [ ] A check fails the seeded mountain and the ice class, and passes the sea surface. The ground state is not a clipped white sheet.

## Acceptance

Before: the path frame `tasks/evidence/path-2026-11-10-pm/07-landed.png` (PR #438) and a same-pose frame on this branch's before capture. After: the same aim, sea not ice. Reference: Sentinel-2 cloudless 2021 (EOX, CC BY 4.0) at that tile, open ocean, mean sRGB about 16, 28, 51. Day 227, morning, sun near 49°, snow 0. The point is not Greenland.

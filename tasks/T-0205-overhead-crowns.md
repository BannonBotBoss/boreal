---
id: T-0205
title: Overhead crowns from the stand placement
author: grokbot-2
scratch: false
research: true
skill: overhead-crowns
tags: [visual]
credits: 39
---
# T-0205 Overhead crowns from the stand placement

Matthew, 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, 2026-11-07: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: `farTreesInTile` and the globe nadir already exist.

D24. PR #429 painted a NAIP texture and the 400 m and 800 m views stayed a noise field. This draws horizontal crown discs from that same stand placement, spaced so the ground shows between them.

## Objectives

- [x] Nadir crowns are instanced horizontal discs from `farTreesInTile`, at least 14 m apart. `tests/overhead-crowns.test.ts`.
- [x] They sit on the visible surface and in the camera-relative frame the tiles use.
- [x] Same pose before and after at 400 m and 800 m. The picture check fails the noise and passes the discs. `tests/overhead-picture.test.ts`.

## Acceptance

URL `?view=globe&latlon=52,-97&shot=1&localClouds=0&hour=8.3&day=227&tier=5` with `alt=400` and `alt=800`. SwiftShader, 1280×720. The point is boreal (cover sample: share 1).

| frame | what it shows |
|---|---|
| `before-400.png` | Green and brown tile noise. No separate crowns. Dark-pixel share 0.027. |
| `after-400.png` | Dark round discs across the middle, with the noise visible between them. Share 0.206. They are discs, not a photograph of a crown. |
| `before-800.png` | The same noise, coarser. Share 0.023. |
| `after-800.png` | Smaller discs, still separate, ground between them. Share 0.206. |

The discs do not cover the corners of the frame. The placement radius is the nadir footprint, a circle.

---
id: T-0109
title: The glide ground reaches the horizon
author: grokbot-3
scratch: false
research: true
skill: horizon-skirt
tags: [globe, terrain, bridge, drone]
credits: 52
---

# T-0109 The glide ground reaches the horizon

Issue #156, front end lane (issue #158, the later comments: grokbot-3 owns the landscape you see and the bridge). This is the first step after T-0108. The drop already lands. The glide still shows a chunk square inside the coarse globe.

Matthew, 2026-10-28 12:31 AM PT, issue #156: "that landscape, if i took a screenshot, should look just like a picture taken from a drone." The horizon rings are the ground under that sentence. Issue #157 is blitz mode.

**Credits: 52** (= 10 × 4 × 1.3). Matthew can change it.

## Why the glide was a square

The chunk dither disc stopped near 80 m (`INPAGE.ring` × `CHUNK_SIZE`). Past that the far layer is the globe, at half resolution once the patch is in, and the globe tiles are the low-detail relief. The camera far plane was about 1–2 km, so a horizon at drone height (tens of kilometres) was never in the game pass.

## Objectives
- [x] The glide ground reaches the geometric horizon at any landing, on rings that reuse the planet height and the globe colour.
- [ ] The chunk patch feathers into those rings, and the outer ring feathers into the globe, so the square edge is gone.
- [x] The skirt stays inside its triangle cap, and the XR caps stay as they are.
- [x] Tests pass, and the stills at the T-0108 landings are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Horizon distance | sqrt(2 R h + h²) | Line of sight to the tangent point on a sphere. Drop at that distance is h R / (R + h). R is `PLANET.radius` (IUGG mean, Moritz 2000, via `PHYS`) | yes |
| Inner ring | 28 m | [game calibration] Under the chunk dither, which starts near one chunk (40 m) | labelled calibration |
| Triangle cap | 6,000 | Ultra globe tiles are 160 × 48² × 2 ≈ 737k (`GLOBE_LOD`). Quest soft ceiling ≈ 750k triangles an eye (`src/core/quality.ts`) | yes |
| Haze start / end | 6 % and 72 % of the outer radius | [game calibration] Aerial perspective. Not a measured extinction coefficient | labelled calibration |

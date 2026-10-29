---
id: T-0111
title: Photographic ground colour on the rings
author: grokbot-3
scratch: false
research: true
skill: open-ground-photo
tags: [globe, terrain, imagery, water]
credits: 39
---

# T-0111 Photographic ground colour on the rings

Issue #156, step 3. The rings have a measured height. This step paints them with an open satellite mosaic, a close-up grain, water Fresnel, and the haze that was already on the skirt.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] Land on the rings uses Sentinel-2 cloudless where a tile is cached, with a procedural grain up close.
- [x] Water uses that colour plus a Schlick Fresnel at F0 = 0.02, and the skirt haze stays.
- [x] Tests pass, and the stills at the T-0108 landings are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Mosaic | EOX s2cloudless 2021 | CC BY 4.0, https://s2maps.eu, modified Copernicus Sentinel data | yes |
| Fresnel F0 | 0.02 | ((1.33−1)/(1.33+1))². Already `fresnelF0` in `src/world/globe/tile.ts` | yes |
| Grain fade | 50 m to 700 m | [game calibration] A 10 m pixel should not be the whole near view | labelled calibration |
| Haze | 6 % to 72 % of the outer radius | [game calibration] Aerial perspective, not a measured extinction | labelled calibration |

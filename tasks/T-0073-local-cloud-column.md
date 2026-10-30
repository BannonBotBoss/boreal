---
id: T-0073
title: Local volumetric clouds from the sim column - dew point, LCL base, buoyant top
author: grokbot-1
scratch: false
research: false
skill: false
tags: [globe, render, sim]
credits: 20
---

# T-0073 Local cloud column

Matthew 2026-10-24 (relayed): visible clouds from water vapour via the dew point. The grid is fine (no vapour particles). Render
only the region around the camera as stacked vertical layers, ray-marched; keep the cheap shell elsewhere; stop the descent fade.
Proposal: https://github.com/BannonBotBoss/boreal-/discussions/1#discussioncomment-19170808

- `data/earth/cloud-column.json` (cited) + `src/core/atmo/cloudColumn.ts`: per-layer T (mixed layer, then 6.5 K/km), q (2 km
  scale height), RH, dew point (Bolton 1980), parcel on dry then moist adiabat; base = LCL, top = end of buoyancy, plus
  Sundqvist layer cloud.
- `src/world/globe/localClouds.ts`: 64x64x48 R8 Data3DTexture over a 32 km x 12 km box at the camera, ray-marched
  (three.js webgl_volume_cloud method, MIT). Inputs from the sim planes tair, q, cloud. `?localClouds=0` turns it off.
- `globeView.ts`: the shell no longer fades on the descent unless the local column is drawing.
- Kenora July normals (19.7 C, RH 0.6): dew point 11.7 C, cloud base 1250 m, buoyant top 6000 m.

## Objectives
- [x] Cited constants and pure column model with tests
- [x] Local ray-marched box wired into the globe
- [x] Descent no longer removes clouds
- [x] In-page band: the dew-point box stays through the ground fade-in (#203) and past the 60 m handover, the painted dome only fills the sky past the box edge (#205)
- [x] Terrain depth occlusion: ridges in front hide the box in the band (#204)
- [ ] WebGPU path (later)
- [ ] Browser frames at 1.5 km, 1 km and 700 m on a descent (rule 6); the #203-#205 checks are headless only

---
id: T-0108
title: Double-click the globe, glide above the animals
author: grokbot-3
scratch: false
research: true
skill: globe-to-animals
tags: [globe, animals, bridge, models]
credits: 65
---

# T-0108 Double-click the globe, glide above the animals

Issues #156 and #158. This is the bridge lane: the globe click becomes the drone, and the animals already in the sim are drawn finer as the eye gets closer. Landscape realism is Grokbot-1. Worldwide species ranges are the biological back end (`grokbot-3/bio-backend-`).

Matthew, 2026-10-28 12:20 AM PT, asked for the drop and the animal ladder in chat. That request is the plan approval (tasks/RULES.md rule 16). Issue #157 (12:34 AM PT) is blitz mode: this change is merged by its author once the type check and `npm test` pass.

**Credits: 65** (= 10 × 5 × 1.3). Matthew can change it.

## Why a far click used to miss

The forest is one local frame. `sampleSurface` writes game x and z only inside the Kenora home square (`PLANET.home.halfSize`, 3,840 m). Everywhere else those coordinates stay 0, so `descend` placed the player on the wolf's lake. Chunks, the weather read (`planet.fromLocal`), and `plantsGrowAt` (hard-wired to 49.77 N) all followed that frame. The origin bus exists and nothing calls it.

## Objectives
- [ ] A double-click anywhere falls through the clouds the sky already draws and becomes the existing drone, gliding a few hundred metres up, until the player flies lower.
- [ ] Off the home square, the same forest frame is anchored on the click (planet height, weather direction, tree line). Home is unchanged.
- [ ] Animals the sim already placed fade from specks, to a low body, to the full model, with `setBodyShare`. No domes.
- [ ] Gray Wolf uses the Meshy proof model, scaled to the species shoulder. Every other species keeps the procedural body until a file is in the manifest.
- [ ] `npx tsc --noEmit` and `npm test` pass. The number table and the stills are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Glide height | 400 m (`mapHoldM`) | [game calibration] Between #107's 100 m animal station and its 1 km habitat station. "A few hundred metres." | labelled calibration |
| Full / low / speck | 16 / 48 / 140 m | [game calibration] Pretty close, closer, and a herd as specks. Not a measured acuity. | labelled calibration |
| Glide speed | 8 m/s | [game calibration] Between the photo fly's 6 m/s and its 25 m/s fast speed. | labelled calibration |
| Cloud shell | 2.5 km | `CLOUDS.heightKm`, the deck the globe already draws | reused |
| Local cloud top | 12 km | `LOCAL_CLOUDS.topM` | reused |
| Fall handoff | 3,048 m | 10,000 ft × 0.3048 m (NIST SP 811), `FALL_END_M` | yes |
| Wolf shoulder | 0.74 m | Species row `Gray Wolf`. The plan cites 80–85 cm (Mech / Wikipedia "Wolf"); the row's 0.74 m is the size already shipped | reused |
| Wolf mesh | 26,033 triangles, textures 1024², 1.94 MB | Meshy proof, attached. Low file stayed at 18,193 triangles after gltf-transform simplify (the error bound stopped it) | measured |
| Deer and hare density | unchanged | Kenora deer 1/km² and hare peak 10/ha stay in `coarse.ts` and `habitat.ts`. This task does not add a range | reused |

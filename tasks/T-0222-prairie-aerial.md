---
id: T-0222
title: Prairie overhead is cured grass, not conifer salt
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 26
---
# T-0222 Prairie overhead is cured grass, not conifer salt

Matthew, 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". The 2026-11-12 path on main `0f6edb8d` held the drop at 2000 m. The HUD said prairie, vegetation 0.33, and the picture was the Minnesota conifer crop as salt. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x 1.3 (research: Oke 1987 albedo, NAIP ground sample distance). Not from scratch: `coverSampleAt`, the thatch colours in `pbr.ts`, and the aerial crop were already there.

PR #447 (`grokbot-2/globe-clouds`) is open. This branch does not edit `cloudCover.ts`, `globeView.ts`, or `orbitAlbedo.ts`.

## Objectives

- [x] At 2000 m over the prairie landing the frame is straw, not the conifer crop's salt. Before and after frames are in the evidence folder, beside a real steppe tile.
- [x] An automatic check fails that before frame and passes the after frame.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Landing class | prairie, vegetation 0.33 | prairie is vegetation below 0.62 | `data/earth/cover-density.json`; path HUD at 49.77 N, 65.54 E | yes |
| Crop sample distance | 1.5954 m | NAIP zoom 16 | `public/aerial/meta.json` | the crop, not this biome |
| Pixel at 2000 m | about 1.3 m (45° lens, 1280 px, width 2 × 2000 × tan(22.5°)) | Sentinel-2 is 10 m | Drusch et al. 2012, the comment already in `tile.ts` | the crop is finer than the pixel, so it aliases |
| Short grass albedo | thatch 0.42, 0.30, 0.11 | 0.16–0.26 | Oke 1987, Boundary Layer Climates, Table 1.1 | yes, in that range |
| Conifer albedo | the crop, not used here | 0.05–0.15 | same table | the wrong cover for this landing |
| Season | day 227, cured | Stipa anthesis is May–July | Flora of China 22; `pbr.ts` `steppeCure` | yes |

## Frames

Reference: Sentinel-2 cloudless 2021, EOX, CC BY 4.0, https://s2maps.eu. Tile zoom 11 at 48.7 N, 57.8 E (western Kazakh steppe). `ref-steppe-sentinel.jpg`. The game point is not that coordinate. The class is the same: open grass, not conifer forest. The mosaic is a summer composite; day 227 is cured, so the game is straw rather than the greener fields north of Astana.

- Before: `tasks/evidence/T-0222/before-2000.png`. Mean RGB about 106, 124, 44. Adjacent-pixel jump about 24. Green salt.
- After: `tasks/evidence/T-0222/after-2000.png`. Mean RGB about 150, 126, 76. Adjacent-pixel jump about 0.3. Straw.
- Side by side, before then after: `side-before-after.png`.
- Before, after, and the steppe tile: `side-reference.png`.

400 m and 800 m after frames are in the same folder. Their centre crops pass the same check. A few green cards remain at the corners of those two frames. They are not the 2000 m field.

## Not this task

Orbit defects (a)–(d) from the review of PR #447 stay on that branch. Gait was not touched.

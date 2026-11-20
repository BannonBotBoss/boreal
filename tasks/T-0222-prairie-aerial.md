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

PR #447 (`grokbot-2/globe-clouds`) is open. This branch does not edit `cloudCover.ts` or `orbitAlbedo.ts`. `globeView.ts` only warms the zoom-16 overhead tiles when the camera is low.

## Objectives

- [x] At 2000 m over the prairie landing the frame is straw, not the conifer crop's salt. Before and after frames are in the evidence folder, beside a real steppe tile.
- [x] An automatic check fails that before frame and passes the after frame.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Landing class | prairie, vegetation 0.33 | prairie is vegetation below 0.62 | `data/earth/cover-density.json`; path HUD at 49.77 N, 65.54 E | yes |
| Crop sample distance | 1.5954 m | NAIP zoom 16 | `public/aerial/meta.json` | the crop, not this biome |
| Pixel at 2000 m | about 2.3 m (45° lens, 720 px tall, height 2 × 2000 × tan(22.5°)) | Sentinel-2 is 10 m; the overhead mosaic is EOX zoom 16, about 1.5 m | Drusch et al. 2012 | one texel is under one screen pixel |
| Short grass albedo | thatch 0.42, 0.30, 0.11 | 0.16–0.26 | Oke 1987, Boundary Layer Climates, Table 1.1 | yes, in that range |
| Conifer albedo | the crop, not used here | 0.05–0.15 | same table | the wrong cover for this landing |
| Season | day 227, cured | Stipa anthesis is May–July | Flora of China 22; `pbr.ts` `steppeCure` | yes |
| Local contrast | 32 px window std at least 2 | reference crop std 9.44, a different gullied steppe | `tasks/evidence/T-0222/ref-steppe-sentinel.png` | the mosaic under this camera is nearly uniform |

## Frames

Reference: Sentinel-2 cloudless 2021, EOX, CC BY 4.0, https://s2maps.eu. Tile zoom 11 at 48.7 N, 57.8 E (western Kazakh steppe). `ref-steppe-sentinel.jpg`. The game point is not that coordinate. The class is the same: open grass, not conifer forest. The mosaic is a summer composite; day 227 is cured, so the game is straw rather than the greener fields north of Astana.

- Before: `tasks/evidence/T-0222/before-2000.png`. Mean RGB about 106, 124, 44. Adjacent-pixel jump about 24. Green salt.
- After: `tasks/evidence/T-0222/after-2000.png`. Land (luma ≥ 80) mean RGB within 10% of the reference 133, 104, 70. An 11-tile Sentinel zoom-16 mosaic, linear and mipmapped. Inside the atlas the photograph covers the height-field water. The drainage is the drainage in the photograph. Pixels under luma 70 stay under 8% of the frame. The pale grey blobs on the right are gone (right-half fraction under 0.004). The green patch in the northwest is in the Sentinel tile itself.
- `after-800.png` is the same photograph. `after-400.png`, `side-before-after.png` and `side-reference.png` were removed. At 400 m the near exemplar crop still paints the lake polygons, and the composites showed an older after frame.

## Not this task

Orbit defects (a)–(d) from the review of PR #447 stay on that branch. Gait was not touched.

---
id: T-0254
title: Orbit land takes its colour from the cover class
author: grokbot-2
scratch: false
research: true
skill: orbit-biome
tags: [visual]
credits: 26
---
# T-0254 Orbit land takes its colour from the cover class

Matthew, 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". On main `8051065f` the orbit disc was one olive green, a grey wedge sat in central Asia, and the Antarctic coast followed the coarse mesh. Apollo 17 AS17-148-22727 shows the Sahara tan, the Congo green, and a coast that is not a stair.

Credits 26 = 10 x 2 objectives x 1.3 (research: Hadley belts, cover-density thresholds, ETOPO1). Not from scratch: `coverKind` and the bilinear DEM were already there.

No approve-plan is recorded by this agent. The branch is not claimed.

## Objectives

- [ ] From orbit the Sahara reads tan and the Congo reads green, and the Caspian is not a grey ocean wedge. Before and after frames sit beside Apollo 17 AS17-148-22727.
- [ ] An automatic check fails a one-green map and passes this cover map, including a soft Antarctic coast.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Desert line | vegetation below 0.28 | the cover split already used at the feet | `data/earth/cover-density.json` | yes |
| Sahara moisture | about 0.11 at 24 N, 1800 km inland | subtropical descent, dry interior | Holton & Hakim, the Hadley cell; same belts as `ORBIT_ZONAL` | yes |
| Congo moisture | about 0.9 | equatorial wet | same | yes |
| Caspian surface | below 0 m, not in the ocean flood | about −28 m, enclosed | bilinear zoom-0 DEM (ETOPO1 via Mapzen) | yes |
| Coast | 2-pixel mean of the 1024×512 mask | not a 310 km quad | `tests/orbit-detail.test.ts` states the Minimum vertex spacing | yes |

## Frames

Reference: Apollo 17 AS17-148-22727, 7 December 1972, NASA. https://images.nasa.gov/details/as17-148-22727 Also https://visibleearth.nasa.gov/images/1133/the-blue-marble. Copy: `tasks/evidence/T-0254/ref-apollo17.png`.

- Before, Africa: `before-africa.png`. One olive land.
- After, Africa: `after-africa.png`. Sahara tan, Congo darker green.
- Before, home longitude: `before-home.png`. Grey wedge in central Asia, wide peach limb (the limb is T-0255).
- After, home: `after-home.png`. Arabia and Australia tan, the wedge gone.
- After, looking south: `after-pole.png`. The limb is still the wide peach band.

SwiftShader, Chrome, 1280×720. About 1 frame per second. No page error.

## Not this task

The wide peach terminator stays in `atmWarmSun`. Gait was not touched. T-0239 through T-0253 were not edited.

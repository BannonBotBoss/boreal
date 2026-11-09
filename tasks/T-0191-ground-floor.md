---
id: T-0191
title: Prairie ground at the spawn is thatch and soil, not a lawn
author: grokbot-2
scratch: false
research: true
skill: continuous-sward
tags: [visual]
credits: 26
---
# T-0191 Prairie ground at the spawn is thatch and soil, not a lawn

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the terrain shader and the landing report already exist.

The spawn reports prairie, vegetation 0.33, no water, about 49.77 N, 65.54 W, elevation about 216 m, day 227, sun elevation about 37°, snow 0. The ground under the wolf was one dark green. That colour is the Sentinel-2 grassland pixel, which is the wrong scale for a person's feet. Senescent grass is brighter and browner than live leaf (Sims and Gamon 2002, Remote Sensing of Environment 81:337).

## Objectives

- [x] At the spawn the ground underfoot shows thatch, soil and live grass. It is not one green lawn.
- [x] `tests/ground-floor.test.ts` flags the before frame as a lawn and passes the after frame. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0191/before-ground.png` (the T-0189 ground frame). After: `tasks/evidence/T-0191/after-ground.png`. Same `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`.

---
id: T-0194
title: A dry prairie horizon is land, not a sea
author: grokbot-2
scratch: false
research: true
skill: horizon-skirt
tags: [visual]
credits: 26
---
# T-0194 A dry prairie horizon is land, not a sea

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the skirt and the staged water sheet already exist.

The spawn is seed 1400, 49.77 N, 65.54 E, prairie, snow 0, day 227, about 08:46. The feet are thatch. The horizon was a flat grey sheet. A cell under the 8th-percentile line is not a sea. Open water is a lake, a pond, or a channel. The sheet was the skirt fading dry land to the sky fog and pasting a cool far-layer texel.

## Objectives

- [x] The dry prairie horizon is land. The flat sea square is not drawn on staged terrain. A cool flat far texel is not pasted onto dry ground.
- [x] `tests/prairie-horizon.test.ts` scores the matched frames on sky luminance and the horizon brightness profile against the Comanche National Grassland horizon, and on the cool flat run. The author does not approve the work.

## Acceptance

The open-prairie pair is one pose: seed 1400, x 65.4, z −18.6, yaw 5.140, day 227, 08:46. Before: `tasks/evidence/T-0194/before-horizon.png` (main `66deb5e`, also `main-66deb5e.png`). After: `tasks/evidence/T-0194/after-horizon.png`. Reference: `tasks/evidence/T-0194/ref-comanche-horizon.png` (US National Park Service, public domain, 29 May 2015, Comanche National Grassland). Same cover the game reports (prairie, snow 0). Not Kenora. Not these coordinates.

The white sky, the hard horizon step, and the blotchy ground are already on main at this pose. This branch matches those numbers and does not fix them. The spawn heading (yaw 2.054) still shows the grey-blue band on both builds (`spawn-main.png`, `spawn-branch.png`).

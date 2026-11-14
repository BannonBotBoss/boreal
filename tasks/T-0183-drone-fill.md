---
id: T-0183
title: Drone land is not one green fill
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0183 Drone land is not one green fill

Matthew, direct chat 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:45 PT: "yes, and go over anything else that needs fixing.  i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the stand mosaic and the far layer already exist. The 10 m pixel is Drusch et al. 2012.

At 52 N, 97 W the game reports boreal (vegetation about 0.93), day 227, morning, sun about 32°. The drone at 400 m was one green. The far layer was 320×144 while it was the whole picture, and the stand mosaic was inside the detail gate that Minimum turns off.

## Objectives

- [x] Above 150 m the far layer stays full resolution, so the drone picture is not one upscaled texel.
- [x] The stand mosaic runs without the detail gate, after the era colour, and a coarse drone tile widens the wave until it is a few pixels.
- [x] `tests/drone-fill.test.ts` flags a one-colour or black ground crop, and the before frame fails it while the after frame does not. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0183/before-400.png` (one green). After: `tasks/evidence/T-0183/after-400.png`, same drop. The boreal is mottled, not one fill.

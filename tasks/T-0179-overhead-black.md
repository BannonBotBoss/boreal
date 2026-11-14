---
id: T-0179
title: Overhead at 400 m is not a black canvas
author: grokbot-2
scratch: false
research: false
skill: overhead-black-veil
tags: [visual]
credits: 30
---
# T-0179 Overhead at 400 m is not a black canvas

Matthew, direct chat 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:45 PT: "yes, and go over anything else that needs fixing.  i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 30 = 10 x 3 objectives.

On main `669a5a88`, `?view=globe&alt=400&latlon=52,-97&shot=1` is a black canvas (centre rgb 0,0,0, black share 1) while the HUD draws 29 tiles. `?localClouds=0` on that URL shows the ground. The volume march had optical depth and no light, so it composited black over the planet. 8000 m and 80 m on the same point are no longer black.

## Objectives

- [x] An unlit cloud march does not cover the planet. Overhead at 400 m over 52 N, 97 W is not a black canvas.
- [x] A test locks the check so it does not depend on someone spotting it.
- [x] The author does not approve the work. Grokbot-1 reviews.

## Acceptance

Before: `tasks/evidence/T-0179/before-400.png` (black). After: the same URL shows the ground.

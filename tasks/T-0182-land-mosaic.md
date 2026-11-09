---
id: T-0182
title: Vegetated land from above is a stand mosaic
author: grokbot-2
scratch: false
research: true
skill: land-mosaic
tags: [visual]
credits: 39
---
# T-0182 Vegetated land from above is a stand mosaic

Matthew, direct chat 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:45 PT: "yes, and go over anything else that needs fixing.  i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the tile shader and the skirt already colour the land. The waves are Sentinel-2's scale (Drusch et al. 2012).

At 52 N, 97 W the game reports boreal (vegetation about 0.70). Overhead at 400 m was one olive fill. The glide at that height was flat neon tiles. Vegetated land seen from above should be a stand mosaic, the way a Sentinel-2 true-colour image of that boreal is.

## Objectives

- [x] Overhead land at drone height carries a 40 / 160 / 640 m stand mosaic, and a full disk does not.
- [x] The skirt uses the same waves and does not apply the green gain that turned coarse triangles neon.
- [x] `tests/land-mosaic.test.ts` locks both. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0182/before-400.png` (one olive). After: `tasks/evidence/T-0182/after-400.png`, same URL. The boreal is mottled, not one fill.

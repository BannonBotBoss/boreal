---
id: T-0174
title: Keep the loading screen until the ground under the player exists
author: grokbot-2
scratch: false
research: false
skill: warm-startup
tags: [startup, loading, ground]
credits: 30
---
# T-0174 Keep the loading screen until the ground under the player exists

Matthew, direct chat 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:42 PT: "the view isnt necessarily going to look like kenora". At 17:45 PT: "yes, and go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues".

Credits 30 = 10 x 3 objectives (rule 14). `scratch` is false: `startup()` and `settleWhenLandReady` already exist.

The page reports a closed boreal stand (vegetation 1, day 227, hour 15, snow 0, dry, 49.77 N, seeded longitude 65.54 E, elevation 370 m). The embodied view after the splash was a pale field, about RGB 228,228,228, with animals and the HUD as the only non-pale pixels (share 0.08). Cold startup stops at the 20 s interest-queue ceiling while grass jobs are still queued, and that path did not require the standing chunk.

## Objectives

- [x] A cold start whose interest queue never goes quiet does not reveal while the standing chunk is still missing. It waits for that chunk on its own, behind the splash, bounded by the same ceiling.
- [x] A cold start whose chunk is already in still ends the queue wait as it does today, and does not add a second wait.
- [x] `tests/startup-warm.test.ts` covers both. `npm test` for that file and `npx tsc --noEmit` pass.

## Acceptance

The before frame is `tasks/evidence/T-0174/01-ground-forest.png`. The after frame is taken once the splash has left on this branch.

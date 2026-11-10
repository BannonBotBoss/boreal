---
id: T-0196
title: The cold card leaves once the standing chunk is in
author: grokbot-2
scratch: false
research: false
skill: warm-startup
tags: [visual]
credits: 20
---
# T-0196 The cold card leaves once the standing chunk is in

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 20 = 10 x 2 objectives. Not from scratch. The landing already runs chunk jobs ahead of grass (`LANDING_JOB_MS` 160, `JOB_FIRST`). This card did not.

On main `f55f7b8`, `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`, SwiftShader. The card was still "Generating the land around you…" at 21 s, then "Building the ground here…" until about 45 s, and gone at 47 s. Flora is priority −1, so it runs before the standing chunk, and the 4 ms job budget never gives that chunk a turn. The wait then hits the 20 s ceiling, and the main-thread rebuild hits the next one.

## Objectives

- [x] The cold card leaves once the standing chunk has been in the scene. A full grass queue does not hold it for the 20 s ceiling.
- [x] `tests/startup-warm.test.ts` fails the old wait (more than 500 pumps while the chunk is already in and the queue stays full) and checks the landing budget is on only during that wait. The author does not approve the work.

## Acceptance

Same URL. Before: `tasks/evidence/T-0196/before-15s.png` (the birch card, still up). After: `tasks/evidence/T-0196/after-28s.png` (the spawn, card gone). The poll on this branch left the card at about 24 s. The world in that frame is the spawn, not a pale void.

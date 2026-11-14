---
id: T-0180
title: Land on the bank, not in the flat lake
author: grokbot-2
scratch: false
research: false
skill: bank-stand
tags: [visual]
credits: 30
---
# T-0180 Land on the bank, not in the flat lake

Matthew, direct chat 2026-11-07 18:40 PT: "all of the things that do not look right, must be fixed, o know the steps, ive been asking abo:Ut it for a long while now. please, get it donwe". At 17:45 PT: "yes, and go over anything else that needs fixing.  i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 30 = 10 x 3 objectives. Not from scratch: `landSpawn` and `forestLanding` already exist.

After the drop the wolf stood on the flat water plane. The home lake's nearest dry cell is the waterline, and the store mark faces that shore, so the camera looks across the lake. The biome at that stand is boreal (vegetation 1, snow 0). She should stand on dry ground at the bank, facing the trees.

## Objectives

- [x] A drop, a cold start, and Return to start whose nearest dry cell is the waterline stand on ground clear of the lake, facing the trees.
- [x] The splash waits on that same point, so the loading card does not stay up.
- [x] `tests/bank-stand.test.ts` locks the check. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0180/before-bank.png` (the shore, the lake filling the view). After: `tasks/evidence/T-0180/after-bank.png`, same URL, the animal on dry ground with the lake in the distance.

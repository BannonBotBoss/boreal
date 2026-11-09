---
id: T-0190
title: The spawn wolf is a timber coat, not a white lamp
author: grokbot-2
scratch: false
research: true
skill: meshy-animal-skin
tags: [visual]
credits: 26
---
# T-0190 The spawn wolf is a timber coat, not a white lamp

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the Meshy wolf and the coat shader already exist.

The spawn reports prairie, vegetation 0.33, no water, day 227, about 08:45, sun elevation about 37°, snow 0. The adult in the middle of that frame was pure white with a yellow fringe. Grey wolf guard hair is charcoal on the saddle and cream on the belly (Young and Goldman 1944, The Wolves of North America; Gipson, Bangs et al. 2002, Wildlife Society Bulletin 30(3):821).

## Objectives

- [x] The adult wolf at the spawn is a grey timber coat. It is not a white body with a yellow rim.
- [x] `tests/wolf-coat.test.ts` flags the before frame because the wolf is a white core with a warm rim, and passes the after frame. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0190/before-ground.png` (same frame as `tasks/evidence/T-0189/ground-floor.png`). After: `tasks/evidence/T-0190/after-ground.png`. Same `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`. The game reports seed home, about 49.77 N, 65.54 W, prairie, vegetation 0.33, elevation about 216 m, day 227, sun about 37°.

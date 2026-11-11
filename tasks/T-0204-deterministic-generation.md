---
id: T-0204
title: A generated thing is the seed, the place, the time, and the parent
author: grokbot-2
scratch: false
research: true
skill: deterministic-generation
tags: [design]
credits: 26
---
# T-0204 A generated thing is the seed, the place, the time, and the parent

Issue #97, closed on GitHub, with no task. Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: `proc/rng.ts` is already the seeded stream. Plan approval is not recorded here.

#97: universal seed, location, time, and parent conditions determine the result. The same inputs play back the same entity.

## Objectives

- [ ] State the formula in one place and point at the generators that already follow it.
- [ ] Name any generator that still calls an unseeded source, or say there is none, with the search.

## Acceptance

Rule 12. A reviewer can replay one named entity from the formula.

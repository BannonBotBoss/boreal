---
id: T-0099
title: The strongest urge wins
author: grokbot-3
scratch: false
research: true
skill: strongest-urge
tags: [behaviour, habitat]
credits: 39
---

# T-0099 The strongest urge wins

Step 10 of `notes/design-roadmap.md`. Issues #100, #101, and #103. Conflict 4: #103 wins, reusing `src/core/agent.ts` utilities. #101's `choose_action` cutoff ladder loses. Not claimed. grokbot-3 wrote the plan and does not approve it.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Hunger, thirst, fear, fatigue, and the habitat score from step 9 change which urge is strongest. The animal then feeds, drinks, flees, rests, or moves. There is no ladder of magic cutoffs.

## Kind

Reuse. `decide` already picks the highest utility. This task feeds step 9's cell into that comparison as severity × the species utility × the opportunity (#100's product). It does not add `choose_action`. `AnimalBrain` stays the legs until step 13. Render and camera files stay untouched.

## Objectives
- [ ] Hunger, thirst, fear, fatigue, and the habitat score change which urge is strongest, and the animal feeds, drinks, flees, rests, or moves
- [ ] A hungry animal approaches food and flees when a predator is sensed, recorded
- [ ] Numbers table (game value, published value, source, yes or no). The cited need rates on `needs/engine.ts` stay. No threshold constants 90, 80, 25, or 85

## Gates

Frame: the recorded trace of the approach and the flee. The picture is unchanged, because the deer loop and the camera are not edited. Evidence: `tests/strongest-urge.test.ts` and `src/core/agent.ts`.

## Depends on

Step 9 (T-0098, pull request #145). This branch starts there. It merges after #145.

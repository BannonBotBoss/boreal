---
id: T-0010
title: Wolf Autonomous mode on the shared agent core: moves with a reason, jumps only when a log blocks the way to a goal
author: grok
scratch: false
research: false
skill: false
tags: [animal, behaviour, wolf, autonomy]
credits: 50
---
# T-0010 Wolf Autonomous mode on the shared agent core

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 50** (= 10 x 5 objectives x (1), tasks/README.md). Matthew can change it.

## Goal
Replace autonomousWolfStep and the obstacle rules in AnimalBrain.decide with the shared agent core, so the autonomous wolf follows scents, food, water and rest from its own levels.

## Why
Plan step 1. Today any log or rock within 1.8 m ahead triggers a jump (animalBehavior.ts:56-62), other obstacles back up 0.7 s and turn 117 degrees (:63-67), explore is a sine wave (:90-91) and autonomy.ts:8-16 runs straight at 4 m/s. Matthew: "in automatic mode, the animal, including the wolf, just randomly jumps around. what is directing those actions?"

## Files
- `core/autonomy.ts`
- core/animalBehavior.ts (decide: strip the obstacle/explore rules, keep the player command path)
- core/species.ts (wolf BEHAVIOUR row)
- `main.ts:334-348`
- `tests/autonomy.test.ts`

## Size and risk
- Size: M
- Risk: low-medium: player path must stay identical

## Depends on
- T-0009

## What Matthew will see
In Autonomous mode the wolf trots toward a scent or forage, stops to eat, rests when tired, steps around logs and jumps one only when it is in the way of where it is going.

## Acceptance criteria
- Autonomous wolf never jumps unless its planned path to the current goal crosses a low obstacle and the jump costs less energy than the detour
- No sine-wave or timer explore; with nothing sensed and no need it rests or follows the strongest scent
- Manual control unchanged (same tests, same feel); setAutonomous off on input still works
- Inspector or status line shows the goal and its cause

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Wolf BEHAVIOUR row: sense ranges, diet, needs, rest and travel rules
- [ ] autonomousWolfStep calls the agent core; decide() keeps only the player command branch
- [ ] Obstacle handling in plan(): detour vs jump by energy cost on the path to the goal
- [ ] Goal and cause in the inspector / status line
- [ ] Tests: no purposeless jumps over a field of logs; goal-directed travel; manual path unchanged

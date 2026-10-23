---
id: T-0055
title: The steered wolf walks through a spruce
author: grok
scratch: false
research: false
skill: false
tags: [collision, wolf, trees]
credits: 30
---

# T-0055 The steered wolf walks through a spruce

Suggested owner: whoever next claims player movement. Proposed by grok on the 2026-10-23 07:17 PT loop. Not claimed here: the author cannot approve-plan it.

## What is wrong
The player branch in `src/main.ts` (line 388) moves with `steerWolf` only. `steerWolf` (`src/core/locomotion.ts`) integrates heading and speed. It does not read the world.

`autonomousWolfStep` already refuses the step when a spruce or a person is inside `BLOCK.wolf.trunk` (0.7 m) of the probe (`src/core/autonomy.ts` 14–16). Deer use the same idea at `BLOCK.deer.trunk` (0.6 m). `tests/autonomy.test.ts` ("autonomous wolf refuses a blocked route") keeps the pose at the origin when a spruce sits at (0, -1).

This run's jack pine is entity `3:4:1` at (146.772, 198.849), scale 1.346, species `jack-pine`. `treeDims` gives `trunkRadius` 0.119 m, so the base radius at that scale is 0.160 m. Placing the player on the trunk (`?at=146.772,198.849,0`) draws the body there: d = 0, tilt (146.772, 5.126, 198.849) (`tasks/evidence/2026-10-23-grok-loop-0717/tree-on-trunk.png`, `tree-close.json` `onTrunk`). Walking north from 1.001 m (`at=146.772,199.85`) passes 0.634 m and 0.234 m and stops the capture at 0.034 m, gait speed 2.00 the whole way (`tree-walk-end.png`). 0.034 m is inside the wood. The follow camera sits behind the wolf, so the stills show the back against the shaft; the overlap is the measured d.

The first walk from 5 m south (`tree-through.png`) only reached 1.03 m before the loop ended. That frame is short of the trunk. The follow-up is the one that enters.

T-0052 is the library sentence that claims collision is unimplemented. T-0032 is sky in the far-shore trunk zone. Neither stops this walk.

## Technique
On the player branch, refuse a step when the probe is inside `BLOCK.wolf.trunk` of a spruce or a person. Reuse the spruce/person term `autonomousWolfStep` already has, and `view.entities()`. Do not copy the water term or the slope term: water entry is T-0054, and this run's slope already follows `heightAt`. Do not change `BLOCK.wolf.trunk`. The 0.160 m wood sits inside the 0.7 m stop, so the wolf stops before the bark. Do not add a radius.

## Calibration
The metric is the horizontal distance from the player to spruce `3:4:1` while gait speed is 2.

- Known match: `autonomousWolfStep` with a spruce at (0, -1) returns x = 0, z = 0 (`tests/autonomy.test.ts`).
- Known mismatch: `tree-close.json` `walk`, which reaches d = 0.034 at speed 2. A stop at the visual radius (0.160 m) still fails, because 0.160 is under 0.7.

Gate: a replay from `at=146.772,199.85` heading 0 never gets closer than 0.7 m. An open walk with no spruce or person inside 0.7 m still moves. Save the distance log with the handoff.

## Objectives
- [ ] The player branch refuses a step whose probe is inside `BLOCK.wolf.trunk` of a spruce or a person, reusing `autonomousWolfStep`'s test and `view.entities()`. It does not take that function's water stop or slope stop.
- [ ] `BLOCK.wolf.trunk` stays 0.7 m. No new radius. This pine's 0.160 m base stays inside the stop.
- [ ] A replay from `at=146.772,199.85` stays at least 0.7 m from spruce `3:4:1`, and an open walk still moves. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
The steered wolf stops short of the spruce, the way the autonomous wolf already does.

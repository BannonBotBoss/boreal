---
id: T-0055
title: The steered wolf walks through a jack pine
author: grok
scratch: false
research: false
skill: false
tags: [collision, wolf, trees]
credits: 30
---

# T-0055 The steered wolf walks through a jack pine

Suggested owner: whoever next claims player movement. Proposed by grok on the 2026-10-23 07:17 PT loop. Corrected on the 08:21 PT loop: the first specimen was an unplaced jack pine, and the frames showed a boulder. The placed trunk below is the one the wolf enters. Not claimed here: the author cannot approve-plan it.

## What is wrong
The player branch in `src/main.ts` (line 388) moves with `steerWolf` only. `steerWolf` (`src/core/locomotion.ts`) integrates heading and speed. It does not read the world.

`autonomousWolfStep` already refuses the step when a tree or a person is inside `BLOCK.wolf.trunk` (0.7 m) of the probe (`src/core/autonomy.ts` 14–16). Every tree entity has catalog kind `spruce`, including pines and broadleaves (`src/core/catalog.ts`). Deer use the same idea at `BLOCK.deer.trunk` (0.6 m). `tests/autonomy.test.ts` ("autonomous wolf refuses a blocked route") keeps the pose at the origin when a tree sits at (0, -1).

The 07:17 point is not a placed tree. Candidate `3:4:1` is a jack pine at (146.772, 198.849), scale 1.346, base radius 0.160 m, and `applyPopulation` drops it: stand stems at the chunk centre are 1070 /ha, `treeMult` is 0.45, and `hash('keep:3:4:1')` is 0.952. Nothing placed is within 1.5 m of that point. The nearest rock is `stones:3:4:52` at (146.600, 196.796), 2.06 m north, which is what the follow camera was looking at. `tasks/evidence/2026-10-23-grok-loop-0817/phantom-follow.png` and `phantom-side.png` show the wolf and that boulder. They do not show a trunk through the body.

The placed tree is jack pine `3:4:10` at (141.900, 196.983), scale 1.284, `treeDims` trunk radius 0.119 m, base radius 0.153 m. Walking north from 1.20 m (`at=141.900,198.183,0`) reaches d = 0.033 m at gait speed 2.00 (`capture.json` `walk`). Standing on the axis (`at=141.900,196.983,0`) is d = 0. The follow camera sits behind the wolf, so `pine-inside-follow.png` and `pine-on-follow.png` show the back and the rock ahead. The side camera, 7.7 m east, shows the trunk through the chest: `pine-overlap-east.png` and `pine-inside-side.png`.

T-0052 is the library sentence that claims collision is unimplemented. T-0032 is sky in the far-shore trunk zone. Neither stops this walk.

## Technique
On the player branch, refuse a step when the probe is inside `BLOCK.wolf.trunk` of a tree (catalog kind `spruce`, which is this jack pine) or a person. Reuse the tree/person term `autonomousWolfStep` already has, and `view.entities()`. Do not copy the water term or the slope term: water entry is T-0054, and the 07:17 slope already follows `heightAt`. Do not change `BLOCK.wolf.trunk`. The 0.153 m wood sits inside the 0.7 m stop, so the wolf stops before the bark. Do not add a radius. Do not use `3:4:1`: it is not in the world.

## Calibration
The metric is the horizontal distance from the player to jack pine `3:4:10` while gait speed is 2.

- Known match: `autonomousWolfStep` with a tree at (0, -1) returns x = 0, z = 0 (`tests/autonomy.test.ts`).
- Known mismatch: `tasks/evidence/2026-10-23-grok-loop-0817/capture.json` `walk`, which reaches d = 0.033 at speed 2, inside the 0.153 m wood. A stop at the visual radius still fails, because 0.153 is under 0.7. The unplaced point `3:4:1` is not this mismatch.

Gate: a replay from `at=141.900,198.183` heading 0 never gets closer than 0.7 m to `3:4:10`. An open walk with no tree or person inside 0.7 m still moves. Save the distance log with the handoff.

## Objectives
- [ ] The player branch refuses a step whose probe is inside `BLOCK.wolf.trunk` of a tree or a person, reusing `autonomousWolfStep`'s test and `view.entities()`. It does not take that function's water stop or slope stop.
- [ ] `BLOCK.wolf.trunk` stays 0.7 m. No new radius. This pine's 0.153 m base stays inside the stop.
- [ ] A replay from `at=141.900,198.183` stays at least 0.7 m from jack pine `3:4:10`, and an open walk still moves. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
The steered wolf stops short of the jack pine, the way the autonomous wolf already stops short of a tree.

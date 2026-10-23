---
id: T-0048
title: Playable wolf jump height follows the ballistic arc already in jump.ts
author: grok
scratch: false
research: false
skill: false
tags: [wolf, physics, jump]
credits: 30
---

# T-0048 Playable wolf jump height follows the ballistic arc

Suggested owner: whoever next claims player locomotion. Proposed by grok on the 2026-10-23 03:14 PT loop. Not claimed here: the author cannot approve-plan it.

The locomotion controller already draws this hop with `jumpFrame`. The playable wolf does not. It draws `gaitPose`'s fixed 0.48 m parabola.

## What is wrong
`quadrupedPose` (`src/core/animalBehavior.ts`, the `lift0` line) takes the jump body height from `gaitPose('jump', …).bob`. That bob is `.48 * 4 * air * (1 - air)` over a fixed 0.85 s (`gaitPose`, same file). `poseWolfRig` puts that bob on the tilt group (`src/render/playerWolf.ts`), and the playable wolf calls `quadrupedPose` from `animate`.

`jumpFrame` in `src/animals/locomotion/jump.ts` already computes the same 0.85 s with the same stage shares (18 % crouch, 65 % air, 17 % landing) and a ballistic flight height `g * T_air / 2 * tau − g * tau² / 2`. `apexHeight()` is `g * T_air² / 8`. `createLocomotion` in `src/animals/locomotion/controller.ts` uses `jumpFrame`. The drawn player does not.

`g` is `gravity()` in `src/proc/physics.ts`: `G M / R²` with CODATA 2018 G (Tiesinga et al. 2021, Rev. Mod. Phys. 93:025010), NASA Earth Fact Sheet mass, and the IUGG mean radius (Moritz 2000). This run: `g = 9.8203 m/s²`, `T_air = 0.552 s`, `apexHeight = 0.375 m`.

Measured on seed 1400, spawn `?at=148,64`, one spacebar jump, `?walkprobe`. The tilt group's world y minus `heightAt` peaked at **0.479 m** at x=148, z=57.548 (body y 5.311, ground 4.832). Score `0.479 / 0.375 = 1.28`, outside 0.95–1.05. The camera rides the body, so `jump-air.png` and `jump-land.png` do not show the hop as a rise on screen (ground-band mean stays about 54). The probe is the measurement.

Walk, run and sprint speeds are not this defect. Sim gait speed was 2.00 m/s trot and 5.80 m/s gallop (targets 2 and 6). Those figures already live in `src/core/gaitData.ts` (Bryce & Williams 2017). A same-sample Shift+C chord took super-stealth (0.35 m/s), which `stepWolfModes` already documents. Wall-clock travel was slow because the frame dt is clamped to 0.05 s on this GPU. None of that is a second task.

Deer rigs call the same `quadrupedPose`, so they pick up the same arc. The hare hop in `src/animals/hare.ts` is a different path and is out of scope. When the wolf jumps stays T-0010. A steered hunting leap stays T-0013.

## Technique
Reuse `jumpFrame` / `apexHeight`. Drive the drawn jump height from that arc. Do not add a second parabola, and do not change the 0.85 s duration or the stage shares.

## Calibration
Metric: peak of (tilt world y − `heightAt`) / `apexHeight()`, one jump, seed 1400, spawn 148, 64.

- Known match: `jumpFrame` at mid-flight. With `tau = airSeconds()/2`, the ballistic terms equal `apexHeight()` (score 1.00). The crouch term has already saturated.
- Known mismatch: this recording, score 1.28. Frames and the probe: `tasks/evidence/2026-10-23-grok-loop-0314/jump-air.png`, `jump-land.png`, `motion.json`.

Gate: the score is between 0.95 and 1.05.

## Objectives
- [ ] The playable wolf's jump body height comes from `jumpFrame` (`src/animals/locomotion/jump.ts`). `quadrupedPose` does not use the 0.48 literal in `gaitPose`.
- [ ] Seed 1400, spawn 148, 64, one jump: peak (tilt world y − `heightAt`) / `apexHeight()` is between 0.95 and 1.05. The handoff records the probe and the frame paths.
- [ ] `npm test` and `npx tsc --noEmit` pass. Walk, run and sprint speeds stay the `gaitData` figures. The 0.85 s duration and the 18/65/17 stage shares stay.

## Acceptance
The drawn hop matches `apexHeight()` within 5 % on the probe above. `jumpFrame` is the only arc. T-0010 and T-0013 are untouched.

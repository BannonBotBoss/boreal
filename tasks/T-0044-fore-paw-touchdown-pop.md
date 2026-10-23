---
id: T-0044
title: Fore-paw touchdown pop - pole-target two-bone IK with a continuous pole vector
author: grok
scratch: false
research: true
skill: pole-target-two-bone-ik
tags: [hare, locomotion, ik, defect]
credits: 39
---

# T-0044 Fore-paw touchdown pop

Suggested owner: grok-gait (Gait Builder). Proposed by grok on the 2026-10-23 01:19 PT loop. Not claimed here: the author cannot approve-plan it.

The hare port is on main. Matthew (Bannon-github) merged PR #38 at 2026-10-23 01:01:59 PT, merge `4cecdf2`. Undo: `git revert -m 1 4cecdf2`. Before that merge he said (2026-10-22 23:25 PT) "Fix the paw pop before merging". It was not fixed. The pop is an open defect on main. T-0009's claim was released the same night; this task is the defect.

## What is wrong
On `708a1ae` (PR #38 head), driving `createBounding` with `foreLock`, the plant-frame elbow interior angle jumps 97.3 / 110.1 / 117.5 deg at 60 Hz for 5 / 8.5 / 11.6 m/s, and 46.2 / 95.4 / 105.8 deg at 120 Hz (tasks/events/2026-10-23T00-30-02-grok-comment-T-0009.json). Doubling the frame rate does not halve the jump. `tests/fore-lock.test.ts` excludes that plant frame (`FORE_CONT.plant = 0`, `FORE_LOCK.plant = 0` in `src/animals/locomotion/bounding.ts`). The plant frame picks a fresh elbow branch. That is the pop.

## Technique
Pole-target two-bone IK: an analytic two-bone solve with a pole / knee-direction target, as in Three.js CCDIK alternatives, Unity's TwoBoneIKConstraint, and Tolani, Goswami and Badler 2000 (Real-Time Inverse Kinematics Techniques for Anthropomorphic Limbs, Graphical Models 62:353, doi:10.1006/gmod.2000.0528). The pole vector is continuous from the previous frame, so the elbow does not flip to the other analytic branch at touchdown.

Not a homemade elbow-branch search, and not a tie-break that picks whichever `solveLeg` branch is nearer the previous elbow. The 00:29 loop's next step was that search. Do not build it.

## Objectives
- [ ] Replace the plant-frame fresh branch in `foreLimb` (`src/animals/locomotion/bounding.ts`, `FORE_CONT.plant = 0`) with the pole-target two-bone solve above. The pole vector carries across the plant frame.
- [ ] Plant-frame elbow interior delta at 5, 8.5 and 11.6 m/s halves when the frame rate doubles, measured at 60, 120 and 240 Hz, and stays within the existing fore-lock omega gate (`tests/fore-lock.test.ts`: `omega_gate = 2 * 88 deg / t_stance`).
- [ ] Evidence frames of the running hare (or the bound-lab rig at those speeds) saved with the handoff, showing the plant frame before and after. `npm test` and `npx tsc --noEmit` pass, including the existing fore-contact 11-36 deg check (Schmidt 2008, JEB 211:3775, Table 4).

## Acceptance
The plant-frame elbow interior delta at 5, 8.5 and 11.6 m/s halves from 60 to 120 Hz and again from 120 to 240 Hz, and each of those deltas is inside the fore-lock omega gate. The frames are in the handoff. No new elbow-branch search.

---
id: T-0102
title: The body feels, and it does not store a mass
author: grokbot-3
scratch: false
research: false
skill: body-feelings
tags: [physiology, animals]
credits: 40
---

# T-0102 The body feels

Step 18 of `notes/design-roadmap.md`. Issues #102, #103, and #106. Not claimed. This task records feelings and steps the existing water and energy equations. It does not draw them and it does not store a weight.

**Credits: 40** (= 10 × 4 × 1). Matthew can change the header.

## Goal

Energy, water, temperature, health, stress, age, stamina, and pain are feelings on the animal in the step 12 store. Mass stays the generated volume times density.

## Plan

The store is the same `EntityStore` (T-0092). This task adds `BodyFeelings` beside `Needs` and `Age`. It does not add a second store and it does not copy `stepNeeds`.

- **Reserves.** Water, energy, and rest stay the three levels `stepNeeds` already steps. Age stays the years already on `Age`. The joined record is the feeling. There is no second energy and no second clock.
- **BodyFeelings.** Stamina, pain, health, air temperature, temperature stress, and oxygen stress. Six f32, 24 bytes. Stamina uses `staminaRates` on real seconds, with the same run, sprint, and recovery split as `stepWolfModes`. Temperature stress is `heatFactor - 1`, the heat term already on the species row. Pain, health, and oxygen stress have no rate (calibration). Pain and oxygen stress start at 0. Health starts full, on the same percent scale as `createNeeds`.
- **Mass.** The step takes the kilograms `rigMass` computed. `speciesCarrying` puts that number on a temporary copy of the species row so `stepNeeds` can read the Taylor term and the water-pool size. The row's cited field metabolic rate and turnover stay. The number is not written onto the animal.
- **Physiology block.** 32 bytes in issue #106's order, so step 19 can copy them to byte 64: hunger, thirst, fatigue, pain, temperature stress, oxygen stress, stamina, reserved. Hunger, thirst, and fatigue are the unfilled share of energy, water, and rest (calibration: the needs percent scale, not a new coefficient). The reserved float stays 0. Age and health are not hidden in it. Emotion stress is not written.
- **Not in this task.** No drawing (frame gate is step 20). No change to the player meter (step 23). No wasm export. No edit to the perception reader, the habitat score, or the urge weights. Those are other open changes.

## Objectives
- [ ] Energy, water, and rest step through `stepNeeds`, and the mass that step reads is the caller's generated mass
- [ ] The 32-byte physiology block matches issue #106 and sits at the perception offset
- [ ] Pain, oxygen stress, and health carry a calibration label and no new rate; temperature stress is the existing heat factor
- [ ] No weight field on the feelings record; a test still derives mass from the rig

## Gates

Numbers: the existing water and energy equations, parity-checked against `stepNeeds`, including at a mass from `rigMass`. Pain and oxygen stress are calibration (held at 0, no rate). Health is calibration (held full, no rate). Temperature stress is `heatFactor - 1`. Frame: N/A until step 20. The substitute is the numeric check that water and energy match `stepNeeds` and that `readPerception` sees the block at byte 64. Evidence: no assigned weight field; `tests/body-feelings.test.ts` still derives mass from the rig and checks that doubling the scale multiplies it by eight.

## Depends on

T-0092 (step 12), which is on main (`daaf341`). Does not wait on the open habitat or urge changes.

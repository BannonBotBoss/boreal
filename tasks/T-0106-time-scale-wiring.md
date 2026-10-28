---
id: T-0106
title: Animals, weather, and the ground follow the scale that already exists
author: grokbot-3
scratch: false
research: true
skill: time-scale-follow
tags: [time, animals, weather, ground]
credits: 52
---

# T-0106 Animals, weather, and the ground follow the scale

Step 32 of `notes/design-roadmap.md`. Issues #107, #108, and #109. #109 wins. The eight names, the hysteresis, and the blend are already `observation()`. The density is already step 14 (T-0104). This step wires animals, the weather grid, and the ground to that signal. Near and slow they stay individuals. Faster, the same animals become that density. They transform. They do not pop, and they do not merely freeze.

Not claimed. grokbot-3 wrote the plan and does not approve it.

**Credits: 52** (= 10 × 4 × 1.3). Matthew can change it.

## Goal

When time speeds up, animals, the weather, and the ground change with the scale that is already on the clock.

## Kind

Reuse `observation()`, `resolveObservation`, `SCALE_BOUNDS`, the step 14 density, the interest tiers, and the weather cell. No second list of scales, no second clock, no second wheel. `simWorldSec` stops being the only response above Immediate.

## Objectives
- [ ] Near and slow, an animal is an individual. Through the existing blend, and once the scale has left Immediate, the same animal is the step 14 density, the shares still sum to one, and the density drawing is on before the body is gone
- [ ] Above Immediate, a forward step still moves the weather cell and the ground's snow. They do not only hold. A backward step still does not undo ground years
- [ ] The enter and exit bands stay `SCALE_BOUNDS`. Callers read `observation()`. There is no second scale list
- [ ] Numbers table (game value, published value, source, yes or no)

## Gates

Numbers: the bands already on `SCALE_BOUNDS` (8 and 12, then 800 and 1200, and the bands above). Snow-water is the existing cold-month rule and the existing degree-day factor on the Kenora normals, one year only. The patch strength is labelled game calibration. Frame: crossing a band does not flicker, and an animal becomes the density drawing before the body is gone, recorded. Evidence: `tests/time-scale-follow.test.ts`.

## Depends on

Step 14 is on main (T-0104, pull request #151). The scale signal is `observation()` on main (pull request #92). This step does not multiply by height (step 33) and does not add blur or pitch (step 35). It does not edit the player-entry or playables files.

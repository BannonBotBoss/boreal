---
id: T-0104
title: Far away, or time sped up, the individual becomes a number
author: grokbot-3
scratch: false
research: true
skill: animals-become-density
tags: [animals, density, time]
credits: 52
---

# T-0104 The individual becomes a number

Step 14 of `notes/design-roadmap.md`. Issues #101, #107, and #109. Conflict 2: #109 wins. Individuals exist only while time is slow and the animal is near. Far, or at a faster time level, the same animals are a density, a herd, or a species range. They transform. They do not pop out.

Not claimed. grokbot-3 wrote the plan and does not approve it.

**Credits: 52** (= 10 × 4 × 1.3). Matthew can change it.

## Goal

Near and slow, creatures are individuals. Far, or faster, the same animals are a herd, a density, or a species range.

## Kind

Reuses the interest radii, the headless animal sim, the T-0070 density disc, and `observation()` / `OBSERVATION_SCALES` / `resolveObservation`. No second list of scales. The coarse step is the new piece.

## Objectives
- [ ] Near and slow, an animal is an individual. Far or faster, the same animal is a herd, a density, or a range, and the two shares sum to one population
- [ ] Leaving the near radius paints the density before the body is gone, with no frame where both are absent
- [ ] The coarse step eases a folded count toward the published boreal density and does not step that animal as an individual
- [ ] Numbers table (game value, published value, source, yes or no)

## Gates

Numbers: deer 1/km² (Kenora WMU 6, 1978) and wolves 40/1,000 km² (Fuller, Mech & Cochrane 2003). The year rate that eases toward those figures is labelled game calibration. Frame: leaving the near radius, and a faster time level, recorded. Evidence: `tests/coarse-population.test.ts`.

## Depends on

Step 12 is on main (T-0092). The scale signal is `observation()` on main. This step does not add a wheel and does not edit the open urge, camera, senses, or weather changes.

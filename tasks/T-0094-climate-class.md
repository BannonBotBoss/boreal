---
id: T-0094
title: A climate name from temperature, rain, and the seasons
author: grokbot-3
scratch: false
research: true
skill: climate-class
tags: [climate]
credits: 39
---

# T-0094 Climate class

Step 8 of `notes/design-roadmap.md`. Issue #100. Not claimed. grokbot-3 wrote the roadmap and does not approve this plan.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Average temperature, yearly rain, and how strong the seasons are produce a climate class. Deer and wolves never branch on that class. They read depth, degrees, wind, and food.

## Kind

New classifier over step 2 and step 5. Replaces any future temptation to hand a biome to behaviour. Existing surface bands stay as colours. The module is `src/core/climateClass.ts`. It does not edit the open snow, animal-store, or epoch files.

## Objectives
- [ ] Mean temperature, yearly rain, and the strength of the seasons produce a Köppen–Geiger class, using the published thresholds
- [ ] Those inputs are read from the planet climate, which already includes the sea and the rain shadow
- [ ] Deer and wolf behaviour does not read the class id, and the existing surface colours are not switched by it

## Gates

Numbers: class boundaries from Peel, Finlayson and McMahon 2007, Table 1 (doi:10.5194/hess-11-1633-2007), not round guesses and not issue #100's four unnamed example classes. Frame N/A: the class is not drawn. Evidence: `tests/climate-class.test.ts` shows behaviour code does not read the class id.

## Depends on

T-0085 (the sea and the rain shadow are on the grid T-0082 already feeds). Parallel with nothing else in phase A.

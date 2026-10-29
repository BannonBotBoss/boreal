---
id: T-0098
title: A place has food, water, shelter, and a score
author: grokbot-3
scratch: false
research: true
skill: habitat-score
tags: [habitat, climate]
credits: 39
---

# T-0098 Habitat score

Step 9 of `notes/design-roadmap.md`. Issues #100 and #101. Conflict 11: #101's sum wins, and environmental stress stays off this score. Not claimed. grokbot-3 wrote the plan and does not approve it.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Each place carries food, water, shelter, vegetation, competition, and predator pressure. Its score is food + water + shelter − competition − predator pressure.

## Kind

New cell. Reuses the browse crop (T-0015), the stand canopy, and the bucket fill `weatherAt` already returns. Does not edit the open snow, climate-name, or camera changes. Does not read a climate-class name. Does not add #101's cutoff ladder.

## Objectives
- [ ] The score is #101's sum, and environmental stress is not a term
- [ ] A grazed browse cell has less food, and a lower score, than the same cell ungrazed
- [ ] Numbers table (game value, published value, source, yes or no). The cell and the animal code do not read a climate-class string

## Gates

Frame: N/A. Nothing is drawn. The check is two fixture cells and the grazed browse cell. Evidence: `tests/habitat-score.test.ts` and `src/core/habitat.ts`.

## Depends on

Steps 6, 7, and 8 are not on main. Step 6 has no code yet. Steps 7 and 8 are open changes that own the snow and climate-name files. This task reads the plants and the bucket those steps do not have to be edited for. It does not redo them.

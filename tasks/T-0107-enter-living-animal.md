---
id: T-0107
title: You step into an animal that is already alive
author: grokbot-3
scratch: false
research: false
skill: enter-living-animal
tags: [playable, animals]
credits: 50
---

# T-0107 Enter a living animal

Step 17 of `notes/design-roadmap.md`. Issues #102 and #103. Claimed and completed by grokbot-3 under blitz #157 (2026-10-28 03:10 PT). Grokbot-1 squash-merged pull request #155. This is not a finished-work approve.

**Credits: 50** (= 10 × 5). Matthew can change the header.

## Goal

Choosing a wolf, a deer, or a hare enters one that already has an age, a place, and a past. You do not mint a blank body. The shared playable motor stays.

## Plan

The store is the step 12 `EntityStore` (T-0092, on main). The observation record is step 1 (T-0081, on main). This task does not rebuild either.

- **Entry.** `enterLiving` picks the territory holder of that species from the committed `ANM1` pack. `Playable.create(life)` builds the rig with the existing factory (`createPlayerWolf`, `createDeerRig`, `createHareModel`) and `mirrorStoredAnimal`. Bear is not in the store, so it is not offered.
- **Place.** The feet are the store's x, z. The test origin (0, 0) is open water on the staged land, so the recorded stand is `dryStart(0, 0)` on seed 1400, (30, 0). Wolf spacing and hare spacing are the existing rows. The deer stands one hare spacing north of the wolf so the two are not stacked. No new length.
- **Age.** Wolf 2 years inside 13 (Mech & Boitani 2003). Deer 2 years inside 20 (Ditchkoff 2011). Hare 1 year inside 5 (Krebs et al. 2001). Those are the `LIFESPAN` rows already in the repo.
- **Embodied id.** While you are inside the animal, `observationRecord().embodied` is the store handle. Photo mode and `?watch=1` leave it null. `?watch=1` only pulls the existing rider camera back (`WITNESS_ALTITUDE_SCALE` 2, game calibration) so the animal is visible before entry.
- **Memories.** Step 22 is not on main. Entry reads a map of `MemoryMark` and does not clear it. A second entry of the same handle returns the same list.
- **Not in this task.** No density, weather, or ground edit. No wasm rebuild. No `body_mass`. No new species file.

## Objectives
- [ ] Choosing a wolf, a deer, or a hare enters the stored animal of that species through the shared playable motor
- [ ] The embodied id on the step 1 record equals that store id
- [ ] A second entry of the same id keeps the memory marks
- [ ] Age sits inside the species' published lifespan
- [ ] Entering shows that animal where it already stood

## Gates

Numbers: age inside the species' published lifespan (the table below). Frame: entering shows that animal in the place it already stood, recorded. Evidence: the embodied id on the step 1 record equals the store id, and a second entry of the same id keeps the memories from step 22.

| What | Game | Published | Source | Inside? |
| --- | --- | --- | --- | --- |
| Wolf age | 2 years | wild maximum about 13 years; start is the young-adult row | Mech & Boitani 2003 | yes |
| Deer age | 2 years | wild maximum about 20 years | Ditchkoff 2011 | yes |
| Hare age | 1 year | wild maximum about 5 years | Krebs et al. 2001 | yes |
| Wolf pack | 2 | usually 5–8, range 2 to about 15 or more | Mech & Boitani 2003, already on the wolf row | yes |
| Hare count | 1 | usually solitary; group size row minimum 1 | hare row, Behav Processes 1997 | yes |
| Deer count | 1 | no group-size row; one animal to enter | not a new herd size | n/a |
| Witness scale | 2 × rider height | none | game calibration of the existing camera | n/a |

## Depends on

T-0081 (step 1) and T-0092 (step 12), both on main. Does not wait on step 22.

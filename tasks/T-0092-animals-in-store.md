---
id: T-0092
title: The animals live in the entity store
author: grokbot-3
scratch: false
research: true
skill: animals-in-store
tags: [rust, animals]
credits: 65
---

# T-0092 Animals live in the store

Step 12 of `notes/design-roadmap.md`. Issues #101 and #102. Not claimed. This task records creatures. It does not step them and it does not put the player inside one.

**Credits: 65** (= 10 × 5 × 1.3). Matthew can change the header.

## Goal

Position, age, needs, kinship, and territory are components on the step 11 store. Species stay the rows that already exist. A wolf spawned there already has an age and either a parent in the store or an explicit founder flag.

## Plan

The store is `EntityStore` in `rust/boreal-sim` (`hecs` 0.10.5, T-0084). This task adds components to that store. It does not add a second store and it does not add a species file.

- **Species row.** One key for the existing `NEEDS_SPECIES` id (`wolf`, `hare`) and one key for the existing mammal plan (`canid`, `leporid` on the `MAMMALS` row). The skeleton stays `mammalSkeleton` / `validateSkeleton`. Bones are not copied into the store.
- **Position.** `x`, `y`, `z` in metres.
- **Age.** Years, taken from `LIFESPAN[species].startYears` (wolf 2, hare 1). That is the young-adult start already on the lifespan row. Wild maxima on that row stay the citation (Mech & Boitani 2003 for the wolf).
- **Needs.** Water, energy, and rest, the three levels `stepNeeds` already steps. Water and rest start at `createNeeds()` (full). Energy starts at `ANIMAL_DEFAULT_ENERGY`. The rates stay on `WOLF_NEEDS` / `HARE_NEEDS`. They are not copied. `WOLF_NEEDS.body.massKg` is not copied.
- **Kinship.** A parent handle (0 when the parent is not in the store) and a stored `founder` flag. The flag is its own field. A breeding pair uses the flag. Both wolves are founders: their parents are not in the store, and there is no cited pup age to invent.
- **Territory.** The founder's handle and the founder's `x`, `z`. Every pack mate points at that same holder. No new radius. Mates stand `social.spacingM` apart (Mech 1966, already on the wolf row).
- **Group size.** The spawn count is the minimum of the species row `social.groupSize`. Wolf `[2, 8]` (Mech & Boitani 2003: usually 5–8, range 2 to about 15 or more) gives a pair, which is the low end of that cited range and the row's own minimum. Hare `[1, 4]` gives one animal, which matches "usually solitary" on that row. No third number is introduced.
- **Mirror.** `AnimalBrain` gains an optional copy of that record, set only by `mirrorStoredAnimal`. `energy` is copied onto the existing vital. `decide` is unchanged. There is no TypeScript list of entities. Step 13 is what makes the store the authority for the step.
- **Not in this task.** No `body_mass` component (conflict 10; step 18 reads generated mass). No drives (#117). No event log (#119). No wasm export and no change to what the picture draws (frame gate is step 17). Climate and weather files stay untouched (T-0085).

## Objectives
- [ ] Position, age, needs, kinship, and territory are components on the step 11 store
- [ ] A spawned wolf uses the species-row starting age and the wolf row's group size, and has a parent id or an explicit founder flag
- [ ] Species stay the existing rows and the skeleton. No new species file. No `body_mass` component
- [ ] `AnimalBrain` mirrors that record until step 13 and is not a second list of animals
- [ ] Numbers table filled. Frame N/A until step 17, with the numeric check named

## Gates

Numbers: starting age and group size use the citations already on the species rows (Mech and Boitani for the wolf pack). Frame: N/A until step 17. The substitute is the numeric check that the spawned wolf's age equals `LIFESPAN.wolf.startYears` and the pack count equals the wolf row's group-size minimum, which sits inside that row's cited range. Evidence: a wolf spawned by the store has a non-zero age and a parent id or an explicit founder flag. No `body_mass` component.

## Depends on

T-0084 (step 11), which is on main. Parallel with step 18's data definition. Does not wait on T-0085.

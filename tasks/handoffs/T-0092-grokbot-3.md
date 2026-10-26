# T-0092 handoff (grokbot-3)

Branch: `grokbot-3/animals-in-store`. Base: `origin/main` at `ea08a0b`. Not claimed. Not self-approved. Not merged.

## Status

Plan filed. Implementation follows on this branch and does not wait on a claim event. The claim waits on grokbot-1's approve-plan. grokbot-3 does not approve this work. grokbot-2 is down (issue #134) and is not tagged.

## Review inventory (rule 15)

Checked before this task was filed.

- `git fetch origin main`. `origin/main` is `ea08a0b` (T-0085 squash, pull request #136) on top of `6c8d5c2` (T-0084, pull request #135).
- Open pull requests: none. Nothing was waiting on a GitHub review, so this run did not approve or reject a pull request.
- `git log --all --name-only -- "tasks/T-*"` tops out at T-0091. No `T-0092`. No branch and no commit mentions step 12 or `animals-in-store`.
- Ledger (not a review of those tasks): several older tasks are `completed` or `claimed` with no open pull request. Approving one would need a fresh gate run on a pull request that is not open. They were not approved and not edited. T-0085 is `approved` on the ledger (grokbot-1 approve-plan is on main) and its climate files are not edited here.
- This agent does not review its own completed tasks (T-0083, T-0084, T-0090, T-0091).

## Plan (for approve-plan)

The animals are recorded in the step 11 `hecs` store. Species stay data.

1. Components on `EntityStore`: species row (key only), position, age, needs (water, energy, rest), kinship (parent handle and an explicit founder flag), territory (holder handle and home `x`, `z`).
2. Spawn reads `LIFESPAN.startYears`, `WOLF_NEEDS` / `HARE_NEEDS` `social.groupSize` minimum, `social.spacingM`, `createNeeds()`, and `ANIMAL_DEFAULT_ENERGY`. Wolf pack is the row minimum 2, inside Mech & Boitani's range. Both are founders (no cited pup age). Hare is the row minimum 1.
3. Skeleton stays `mammalSkeleton('Gray Wolf')`. No bones and no `massKg` in the store. No `body_mass` component (conflict 10).
4. `mirrorStoredAnimal` copies one record onto `AnimalBrain` (`stored` plus `energy`). No second entity list. `decide` stays the legs until step 13.
5. Nothing is drawn. No wasm export. Climate and weather files are not edited.

## Number table

Filled when the spawn lands. The values are the rows below, not new digits.

| Value | Game number | Real figure and source | Match |
| --- | --- | --- | --- |
| Wolf starting age | `LIFESPAN.wolf.startYears` (2 years) | Young-adult start on `src/core/lifespan.ts`. Wild maximum about 13 years (Mech & Boitani 2003), same row | yes, if the spawned age is that field |
| Wolf group size | minimum of `WOLF_NEEDS.social.groupSize` (2), inside `[2, 8]` | Packs usually 5–8, range 2 to about 15 or more (Mech & Boitani 2003, Wolves ch. 1), already on that row | yes, the minimum of the row. The usual 5–8 is the same citation. This step does not add a third count |
| Hare starting age | `LIFESPAN.hare.startYears` (1 year) | Same lifespan row. Wild maximum about 5 years (Krebs et al. 2001) | yes, if the spawned age is that field |
| Hare group size | minimum of `HARE_NEEDS.social.groupSize` (1) | Usually solitary; loose groups up to an estimated 4 (already on that row) | yes |
| Pack spacing | `WOLF_NEEDS.social.spacingM` (5 m) | Packs travel a few metres apart (Mech 1966), already on that row | yes, placement only |
| Needs | water 100, rest 100, energy `ANIMAL_DEFAULT_ENERGY` | Full `createNeeds()`. Energy is the existing brain default (game calibration, already labelled) | yes, no new rate |

## Frames

Frame gate: N/A until step 17. Nothing on screen changes. No recording. The numeric check is the age and the pack count against the rows above.

## Needs from another agent

@Grokbot-1: approve-plan on T-0092 (a non-author approve-plan). The plan is this file and `tasks/T-0092-animals-in-store.md`. After the implementation is on the branch, review and merge. Do not wait on grokbot-2.

No reference image is needed.

## Next step

Implement the plan on this branch. Do not write a claim event until the approve-plan `at` is earlier. Do not edit climate or weather files.

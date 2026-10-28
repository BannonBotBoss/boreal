# T-0107 handoff (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/enter-living-animal`. Clock: Pacific.

## Board

Proposed by grokbot-3. No approve-plan yet, so no claim and no complete. grokbot-3 wrote the task and cannot approve the plan or the work. The ask is for Grokbot-1. grokbot-2 is down until about midday PT 2026-10-28 and is not tagged. The objectives stay unchecked.

Id scan: `git log --all --name-only -- "tasks/T-*"` on this checkout. T-0104 is on main (`e493650`). T-0105 is open pull request #152 (`grokbot-3/three-blocks`). T-0106 is not on any fetched branch; it is reserved for the step 32 agent and was not taken. T-0107 was free. Used T-0107.

## Rule 15

Open pull request: #152, grokbot-3's own T-0105 (step 19). Not reviewed for approval. No other open pull request.

Pending work by other agents is the set already commented on 2026-10-24 in `tasks/handoffs/grokbot-3-loop.md` (T-0001, T-0007, T-0021, T-0025, T-0028, T-0032, T-0067, T-0069) plus older completes that still have no approve event. This run did not re-execute those gates and does not approve them. Nothing in that set is this task.

## Doing

Choosing a wolf, a deer, or a hare enters the animal the store already recorded. The rig still comes from the shared playable motor. Age, place, and past come from that record.

## Depends

- Step 1, T-0081, is on main. `src/core/observation.ts` `observationRecord` is the record. Not redone. The embodied field now carries the store handle when you have entered, and null before entry and in photo mode.
- Step 12, T-0092, is on main (`daaf341`, and the feelings row from T-0102). The deer was not in that pack. This task appends one deer to the same store. Wolf and hare handles are unchanged because the deer is spawned last.
- Step 22 is not on main. Entry only reads a memory-mark map and does not clear it.

## Done

- [x] `enterLiving` picks the territory holder. Wolf, deer, and hare. `Playable.create(life)` mirrors that record onto the existing factory.
- [x] The page reads `LIVING_PACK`, the same bytes as `tests/fixtures/stored-wolf-pack.bin`.
- [x] Stands: `dryStart(0, 0)` on seed 1400 is (30, 0). Wolf mate at +5 m (the wolf spacing). Hare at +20 m (the hare spacing). Deer 20 m north of the wolf stand. `(0, 0)` is open water on the staged land and is not the stand.
- [x] `buildScene` registers the store handle as the embodied id. `?watch=1` leaves it null and pulls the existing rider camera back by 2 rider-heights (game calibration).
- [x] Bear is not offered. It is not in the store.
- [x] Frame stills. `tasks/evidence/T-0107/before-entry.png` and `after-entry.png`. Copies in `/opt/cursor/artifacts/`.
- [x] `npm test`: 905 tests, 891 pass, 0 fail, 14 todo, exit 0. `npx tsc --noEmit` exit 0.

## How to verify

- `npx tsx --test tests/enter-living.test.ts tests/stored-animal.test.ts`
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities`
- `npx tsc --noEmit`
- `npm test`
- Stills: `node tasks/evidence/T-0107/capture.mjs` with Vite on port 5277. Before is `?watch=1`. After is the same clock without `watch`. No `?at=`.

## Numbers

| What | Game | Published | Source | Inside? |
| --- | --- | --- | --- | --- |
| Wolf age | 2 years | wild maximum about 13 years | Mech & Boitani 2003, already on `LIFESPAN.wolf` | yes |
| Deer age | 2 years | wild maximum about 20 years | Ditchkoff 2011, already on `LIFESPAN.deer` | yes |
| Hare age | 1 year | wild maximum about 5 years | Krebs et al. 2001, already on `LIFESPAN.hare` | yes |
| Wolf pack | 2 | range starts at 2 | Mech & Boitani 2003, the wolf row minimum | yes |
| Hare count | 1 | group-size minimum 1 | hare row | yes |
| Deer count | 1 | no group-size row | one animal to enter, not a new herd size | n/a |
| Witness scale | 2 × rider height | none | game calibration of `positionCamera` | n/a |

## Frames

Day 15 (15 Jan), about 12:06, 1 second per second. No `?at=`. The probe is `window.__boreal.player()` with `?rec`.

Before (`?watch=1`): a grey wolf stands small on the snow at the water's edge, seen from farther behind. Dark rocks sit on the left. The sky is grey. The status line reads snow 34.4 cm. The probe: x 30.000, z about 0, yaw −0.35, handle `4294967296`, embodied null, species wolf.

After (no `watch`): the same wolf, close behind, on the same snow, same rocks, same water line. The probe: x 30.000, z about 0, yaw −0.35, handle `4294967296`, embodied `4294967296`. The two ids match. The wolf did not move to a new place. The view came in behind it.

The shore is open snow, not a closed forest. That is the staged stand at (30, 0) in January, the same dry point `dryStart(0, 0)` already uses. Snow on the ground in a below-zero month is the picture the status line names (34.4 cm).

## What the player sees

The wolf is already standing on the snow by the water. Stepping into it brings the view in close behind that same wolf, in that same spot.

## Needs from another agent

@Grokbot-1: approve the plan, then review. grokbot-3 will not approve or merge. grokbot-2 is not asked.

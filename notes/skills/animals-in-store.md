# Skill: record an animal in the entity store

Use when a creature has to exist in the step 11 store before anyone steps it or steps into it. T-0092 did the first version (roadmap step 12, issues #101 and #102). The store is `hecs` inside `EntityStore`. Do not add a second list, a species file, or a stored weight.

## Steps
1. Read `notes/design-roadmap.md` step 12 and conflict 10. The components are position, age, needs, kinship, and territory. Species stay the rows in `NEEDS_SPECIES`, `LIFESPAN`, and `MAMMALS`. The skeleton stays `mammalSkeleton` / `validateSkeleton`.
2. Add the component to `rust/boreal-sim/src/animals.rs` and spawn it through `EntityStore` (`spawn_animal` / `spawn_pack`). A bare `spawn()` entity stays empty. `COMPONENT_NAMES` is the list a reviewer checks. Do not add `body_mass` or `massKg`. Step 18 reads generated mass.
3. Take the starting age from `LIFESPAN[species].startYears` and the group count from the minimum of `social.groupSize` on that species row. Wolf spacing is `WOLF_NEEDS.social.spacingM`. Do not type a new age, pack count, or radius. Water and rest start at `createNeeds()`. Energy starts at `ANIMAL_DEFAULT_ENERGY`.
4. Kinship stores a parent handle and a `founder` flag as two fields. 0 means the parent is not in the store. The flag is not inferred from that 0. A pack from `spawn_pack` is founders sharing the first handle as the territory holder.
5. `src/core/storedAnimal.ts` `packRequest` is the TypeScript side of those row values. `readStoredPack` reads the `ANM1` bytes `write_animals` writes (12-byte header, then 76 bytes per animal, little-endian, tail float is 0). Regenerate `tests/fixtures/stored-wolf-pack.bin` only with `STORE_DUMP=1 cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities store_fixture -- --nocapture`.
6. Mirror one record onto `AnimalBrain` with `mirrorStoredAnimal`. That sets `stored` and `energy`. It does not push into an array. `decide` stays the legs until step 13. Tag `stored` in `stateFields.ts` (`snapshot`). The live age clock remains `player.bornSec`.
7. Do not export the store to the page in this step, and do not rebuild `public/wasm/boreal_sim.wasm` until something on the page calls it. Do not edit the climate or weather files for an animal-store task.

## Checks that prove it worked
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities` includes the wolf spawn, the parent-id round trip, the empty-spawn check, and the fixture match.
- `tests/stored-animal.test.ts` checks the wolf age against `LIFESPAN.wolf.startYears`, the pack count against the wolf row's group-size minimum, the hare against `HARE_NEEDS`, `validateSkeleton(mammalSkeleton('Gray Wolf'))`, the fixture's founder flag, and `mirrorStoredAnimal`.
- `animals.rs` does not contain `body_mass`, `BodyMass`, or `massKg`.
- `npx tsc --noEmit` and `npm test` pass. Frame gate is N/A until step 17: nothing is drawn. The numeric check is the age and the pack count.

## Mistakes to avoid
- Inventing a pack size between 5 and 8 when the row already stores `[2, 8]`. Use the row. The citation (Mech & Boitani 2003) is already on it.
- Inventing a pup age so a parent id can be non-zero. Founders cover the evidence gate. A parent id is a separate field, tested on its own, not a new life-history number.
- Copying `WOLF_NEEDS.body.massKg` into a component. Conflict 10 forbids a stored weight.
- Giving `AnimalBrain` its own array of animals. The mirror is one optional record.
- Rebuilding the wasm, or editing `weather.ts` / `planet_fundamentals`, while recording animals. Those files belong to other steps.
- Treating a zero parent as the founder flag. Store the flag. A later animal can have a parent and `founder: false`.

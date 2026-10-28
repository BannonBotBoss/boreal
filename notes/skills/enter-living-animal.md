# Skill: step into an animal that is already alive

Use when the player should enter a creature the entity store already recorded, instead of minting a blank rig. T-0107 did the first version (roadmap step 17, issues #102 and #103). The motor stays `Playable` in `src/render/playables.ts`. Do not add a second control path, a species file, or a stored weight.

## Steps
1. Read roadmap step 17 and conflict 17. The player rig used to be created fresh (`Playable.create` with no life). #102 and #103 say the animal already has an age, a place, and a past. The shared motor stays (rule 3).
2. Confirm step 1 and step 12 are on main before editing. Step 1 is `observationRecord` (`src/core/observation.ts`, T-0081). Step 12 is the `ANM1` pack (`rust/boreal-sim/src/animals.rs`, `src/core/storedAnimal.ts`, T-0092). If either is only on a branch, build on that branch. Do not rewrite it.
3. `enterLiving` in `src/core/enterLiving.ts` picks the territory holder of that species (the animal whose territory id is its own handle). Wolf, deer, and hare are the playable lives. The deer has no `NEEDS_SPECIES` row: one animal, age from `LIFESPAN.deer.startYears` (Ditchkoff 2011 for the 20-year maximum). Wolf age and pack size stay the wolf row (Mech & Boitani 2003). Hare age stays `LIFESPAN.hare` (Krebs et al. 2001).
4. `Playable.create(life)` still builds the rig through `createPlayerWolf`, `createDeerRig`, or `createHareModel`, then `mirrorStoredAnimal`. It does not invent energy, age, or a parent. Bear stays unavailable until a bear is in the store. The coat seed is `hash(handle)` from `proc/rng`.
5. The page reads `LIVING_PACK`, the bytes of `tests/fixtures/stored-wolf-pack.bin`. Regenerate that file only with `STORE_DUMP=1 cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib store_fixture_matches -- --nocapture`, then `FEELINGS_DUMP=1` for `feelings_fixture_matches`, then copy the animal bytes into `src/core/livingPack.ts`. A test locks the two copies together. Do not rebuild `public/wasm/boreal_sim.wasm` until the page calls the wasm.
6. The stand is the store's x, z. On seed 1400 the test origin (0, 0) is open water, so the recorded stand is `dryStart(0, 0)`, which is (30, 0). The wolf mate is one wolf spacing (5 m) east. The hare is one hare spacing (20 m) east. The deer is one hare spacing north, so it is not standing on the wolf. Those metres are the existing rows, not a new length. `main.ts` places the player there and calls `dryStart` only if that point is not dry.
7. `buildScene` registers the observation embodied id as the store handle, or null in photo mode and while `?watch=1` (the witness view). `?watch=1` multiplies the rider height by `WITNESS_ALTITUDE_SCALE` (2, game calibration) so `positionCamera` pulls back and the whole animal is in frame. Entering clears that and uses the rider height. Same x, z.
8. Step 22 is not on main. Pass a map of handle to `MemoryMark` (the 20-byte perception mark). `enterLiving` only reads it. A second entry of the same handle returns the same array. Do not add a memory component in this step.

## Checks that prove it worked
- `tests/enter-living.test.ts`: age equals `LIFESPAN[species].startYears` and is inside `maxYears`; `isDry` is true at the stand; `observationRecord().embodied` equals the store handle; a second entry keeps the same memory array; `LIVING_PACK` matches the fixture file; `create(life)` sets `brain.stored.handle`.
- `tests/stored-animal.test.ts` still checks founder, parent, and no weight field, and the stands match `dryStart(0, 0)` plus the existing spacings.
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities` passes, including the fixture match.
- `npx tsc --noEmit` and `npm test` pass.
- Frame: two stills at day 15, hour 12, no `?at=`. `?watch=1` shows the animal standing. Without `watch`, the view is the rider camera at the same x, z. The probe `window.__boreal.player()` (with `?rec`) reports the handle.

## Mistakes to avoid
- Copying the previous animal's energy onto the new one. That erases the stored life. Heading may stay, because the store has no heading and the camera yaw is the control.
- Putting the stand back at (0, 0). On the staged land that point is open water. Use `dryStart`.
- A new camera. The witness view is the rider camera with a higher altitude, which `positionCamera` already scales.
- Editing `src/render/animalDensity.ts`, `src/core/coarse.ts`, `src/core/weather.ts`, or `src/core/ground.ts` for this step. Another change owns the density, the weather, and the ground.
- Importing `node:fs` from `storedAnimal.ts`. The page imports that module. The file read stays in `storedFixture.ts`.
- Claiming or approving your own plan. Ask Grokbot-1. Do not tag grokbot-2 while that bot is down.

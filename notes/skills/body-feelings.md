# Skill: record what a body feels, without storing a weight

Use when an animal's energy, water, temperature, health, stress, age, stamina, or pain has to live on the step 12 store, or when that record has to fill the perception buffer's physiology block. T-0102 did the first version (roadmap step 18, issues #102, #103, #106). Do not add a second needs engine, a second stamina meter, or a stored weight.

## Steps
1. Read roadmap step 18 and conflict 10. Issue #102's `body_mass` is not a component. Mass stays `rigMass`: generated volume times the composition density. The caller passes that number into the step and does not write it back.
2. Keep the reserves where they already are. Energy, water, and rest stay on `Needs` and move only through `stepNeeds` (`src/core/needs/engine.ts`). Age stays on `Age`. The new component is `BodyFeelings` in `rust/boreal-sim/src/animals.rs`: stamina, pain, health, air temperature, temperature stress, oxygen stress. `COMPONENT_NAMES` lists it. A bare `spawn()` still has none.
3. `stepBodyFeelings` in `src/core/bodyFeelings.ts` is the one step. It calls `stepNeeds` with `speciesCarrying`, which copies the species row and replaces only the kilograms the Taylor term and the water-pool size read. The row's cited field metabolic rate and water turnover stay. Stamina uses `staminaRates` on real seconds: run and sprint drain, walk and still recover, the same split as `stepWolfModes`. Temperature stress is `heatFactor - 1`. Pain, health, and oxygen stress are not given a rate.
4. Pack issue #106's physiology block with `packPhysiology`. The order is hunger, thirst, fatigue, pain, temperature stress, oxygen stress, stamina, and a reserved float that stays 0. Hunger, thirst, and fatigue are the unfilled share of the energy, water, and rest reserves on the needs percent scale (`reserveFull`, the value `createNeeds` starts at). That complement is a calibration label, not a second pool. Age and health stay on the joined record. They are not written into the reserved float. Emotion stress is step 19 and is not written here. Copy the 32 bytes to `PERCEPTION.physiologyOffset` (byte 64). Do not edit the reader to make them fit.
5. The bytes are `BDY1`, version 1, 12-byte header, then 32 bytes per animal (handle plus the six floats). Regenerate `tests/fixtures/body-feelings.bin` only with `FEELINGS_DUMP=1 cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities feelings_fixture -- --nocapture`. The animal fixture `stored-wolf-pack.bin` stays as it is. Do not rebuild `public/wasm/boreal_sim.wasm` until the page reads the feelings.
6. Pain and oxygen stress start at 0. Health and stamina start full. Those are calibration: this step has no injury model and no oxygen-debt row. A later contact writes them. Do not invent a coefficient so the field looks alive.

## Checks that prove it worked
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities` includes the feelings round trip and the `BDY1` fixture. `size_of::<BodyFeelings>()` is 24. No component name contains "mass". `animals.rs` does not contain `body_mass`, `BodyMass`, or `massKg`.
- `tests/body-feelings.test.ts` matches water and energy to `stepNeeds` at the row's kilograms and at `rigMass`, including a doubled rig whose mass is eight times. Stamina for one real second of run, walk, and sprint matches `stepWolfModes`. `readPerception` sees the block at byte 64, the reserved float is 0, and emotion stress is 0.
- `npx tsc --noEmit` and `npm test` pass. Frame gate is N/A until step 20: nothing is drawn. The numeric check is the parity above.

## Mistakes to avoid
- Storing the generated kilograms, or copying `WOLF_NEEDS.body.massKg` onto the animal. Conflict 10 forbids a weight field. Pass the rig's number into the call.
- Recomputing field metabolic rate or water turnover at the new mass. `stepNeeds` already reads the row's cited daily totals. Only the Taylor term and the deficit volume take the generated kilograms.
- Putting age, health, or weight in the eighth physiology float. That float is the reserved one from issue #106. Step 19 copies the 32 bytes as they are.
- Writing emotion stress from temperature stress. Conflict 11: the body carries temperature and oxygen stress. The emotion block is a later step, and the habitat score does not subtract this stress again.
- A pain rate, a health drain, or an oxygen curve with a new digit. Label the held value as calibration until a published source or an existing row supplies the rate.
- Mixing clocks. Needs step on game seconds. Stamina steps on real seconds.
- Editing `perceptionBuffer.ts`, `main.ts`, or the climate files for this step. The player meter is step 23. The open snow, sound, habitat, and urge changes already own those files.

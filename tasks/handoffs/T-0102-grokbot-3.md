# T-0102 handoff (grokbot-3)

Branch: `grokbot-3/body-feelings`. Roadmap step 18. Issues #102, #103, #106. Not claimed. grokbot-3 does not approve this work and does not merge it. grokbot-2 is down until about Oct 28 midday PT and is not tagged. The ask is to Grokbot-1.

## Status

Built. Not claimed. Task id T-0102 was still free on the re-check immediately before the task file: the highest id on any fetched branch or open pull request was T-0101. T-0097 through T-0101 are the open changes 144, 145, 146, 148, and 147. Those branches were not edited.

## Review inventory (rule 15)

Checked before the task file.

- `origin/main` is `daaf341` (T-0092, pull request #137). Step 12 is on main. This step depends only on that.
- Open pull requests, left untouched (another agent is merging main into them): #139 snow depth (T-0087), #144 sound direction (T-0097), #145 habitat score (T-0098), #146 strongest urge (T-0099), #147 level view (T-0101), #148 sense pictures (T-0100). This run does not review, approve, or push those branches.
- Files those changes edit were avoided: `perceptionBuffer.ts`, `senses.ts`, `ui/senses.ts`, `habitat.ts`, `agent.ts`, `main.ts`, `weather.ts`, `ground.ts`, `systemProperties.ts`, `wolf-view.test.ts`, the wasm binary, and the climate files. Step 18 does not need the habitat score or the urge weights. It is built against main. Step 19 is what will read those weights.
- This agent does not review its own open changes.

## Plan

The animal in the step 12 store gains a body-feelings record. Mass is not a field on it.

1. `BodyFeelings` on `EntityStore`: stamina, pain, health, air temperature, temperature stress, oxygen stress. Energy, water, and rest stay on `Needs`. Age stays on `Age`. The joined record is the feeling. No second clock and no second energy pool.
2. Water and energy move only by `stepNeeds`. The mass argument is the caller's generated mass (`rigMass`). It is copied onto a temporary species row for that call and is not stored. At the same mass, the feelings step matches `stepNeeds` exactly.
3. Stamina moves by `staminaRates`, with the same run and sprint drain and the same recovery `stepWolfModes` already uses. Real seconds, not game seconds.
4. Temperature stress is `heatFactor - 1`, the heat term already on the species row. Pain, health, and oxygen stress have no rate in this step. They are labelled calibration. Pain and oxygen stress stay at 0 until a later contact writes them. Health stays full on the needs percent scale.
5. The 32 bytes written for the viewer are issue #106's physiology block, in that order, so step 19 can copy them to byte 64: hunger, thirst, fatigue, pain, temperature stress, oxygen stress, stamina, reserved. Hunger, thirst, and fatigue are the unfilled share of the energy, water, and rest reserves (the needs engine's existing percent scale). The last float stays 0. Age and health are on the store record and are not hidden in that reserved float. Emotion stress is not written (that block is step 19).
6. Nothing is drawn. The player wolf's meter is not rewired (step 23). No wasm rebuild.

## What was built

- `BodyFeelings` on the step 12 store (`rust/boreal-sim/src/animals.rs`). Six floats: stamina, pain, health, air temperature, temperature stress, oxygen stress. Energy, water, and rest stay on `Needs`. Age stays on `Age`. `BDY1` is the bytes (`tests/fixtures/body-feelings.bin`, 108 bytes: 12-byte header and three 32-byte rows). The animal fixture is unchanged.
- `src/core/bodyFeelings.ts`. `stepBodyFeelings` calls `stepNeeds`. `speciesCarrying` hands the caller's generated kilograms to that one call. `packPhysiology` writes the 32-byte block. `readPerception` can see it at byte 64.
- Skill `notes/skills/body-feelings.md`. Roadmap step 18 now says `Board: T-0102`.
- No edit to `perceptionBuffer.ts`, `main.ts`, `agent.ts`, `habitat.ts`, the climate files, or the wasm binary. The player meter is unchanged.

## Number table

One hour of game time (3600 game seconds) walking at the wolf row's walk speed (2 m/s), air at 30 °C, which is 10 °C above the row's `heatAboveC`. Starting energy is `ANIMAL_DEFAULT_ENERGY` (75). Water and rest start full (100). The two mass columns are the same function. The only input that changes is the kilograms passed in.

| Value | Game number | Real figure and source | Match |
| --- | --- | --- | --- |
| Water and energy at 40 kg | energy 75 → 66.722; water 100 → 95.425; rest 100 → 85.714 | `stepNeeds` itself. Taylor, Heglund & Maloiy 1982 (the metabolic power in `engine.ts`); Nagy, Girard & Brown 1999 and Nagy & Peterson 1988 already on `WOLF_NEEDS`; AAHA 2024 deficit already on the row | yes. Byte-for-byte the same return as `stepNeeds` given that mass |
| Water and energy at the rig | energy 75 → 62.439; water 100 → 96.216. Rig mass 73.392 kg | Same equations. The kilograms are `rigMass` of `createPlayerWolf(1400)`, volume times canid density | yes. Same parity. The two energies differ, so the generated mass was read |
| Scale law | doubled rig 587.137 kg, ratio 8 | Rule 4. ×2 linear size → ×8 volume → ×8 mass | yes |
| Temperature stress | 0.400 at 30 °C. 0 at or below 20 °C | `heatFactor - 1`. `heatPerC` 0.04 and `heatAboveC` 20 °C are already on the wolf row, labelled there as an estimate | yes. No new coefficient |
| Hunger, thirst, fatigue | unfilled share of the reserves. After the 40 kg hour, hunger is 33.278 | Calibration: the needs percent scale (`createNeeds` starts at 100). Not a second pool | calibration, labelled |
| Pain | 0, and the step does not move it | No injury model and no published rate in this step | calibration |
| Oxygen stress | 0, and the step does not move it | No oxygen-debt row on the species template. A dive model is not this step | calibration |
| Health | 100, and the step does not move it | Calibration: full on the needs percent scale until a contact writes it | calibration |
| Stamina | sprint drains 8.333 % per real second, run 2.778, walk and still recover 10 | `staminaRates(WOLF_NEEDS)`. Sprint 12 s and run 36 s are the game-design seconds already on the row (Mech 2007 is cited there as the longer real chase). One real second matches `stepWolfModes` | yes. Same rates, not a second meter |
| Age | 2 years | `LIFESPAN.wolf.startYears`. Not a second clock | yes |

## Frames

Frame gate: N/A until step 20. Nothing is drawn. The player wolf's meter is not rewired. No recording and no in-game screenshot.

Numeric check, in place of the frame: `tests/body-feelings.test.ts` asserts the water, energy, and rest above equal `stepNeeds`, including at the rig mass and at eight times that mass, and that `readPerception` reads the physiology block at byte 64. The reserved float is 0. Emotion stress at byte 96 stays 0.

## How to verify

Ran on this branch before the review ask:

- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities`: 10 passed, 0 failed.
- `npx tsc --noEmit`: exit 0.
- `npm test`: 871 tests, 857 pass, 0 fail, 14 todo. The board todo is still the legacy rule breaks. T-0102 adds none.
- `npx tsx tools/tasks.ts` shows T-0102 proposed, 40 cr. It is not claimed.

Repeat with `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities feelings` and `npx tsx --test tests/body-feelings.test.ts` to see only this step.

## Evidence a reviewer can spot-check

1. No weight field. `COMPONENT_NAMES` includes `BodyFeelings` and no name contains "mass". `animals.rs` still has no `body_mass`, `BodyMass`, or `massKg`. `size_of::<BodyFeelings>()` is 24 (six f32). The `BDY1` record is a handle plus those six floats.
2. Mass still comes from geometry. The test builds the player wolf, calls `rigMass`, doubles the scale, and checks the mass ratio is 8. The feelings object has no `massKg` key. The step's water and energy equal `stepNeeds` given that same generated mass.
3. The 32 bytes sit at perception offset 64. Hunger is the first float. The eighth float is 0. `readPerception` agrees. Emotion stress at byte 96 stays 0.

## Needs from another agent

Grokbot-1: approve-plan, then review the pull request. grokbot-3 will not approve it and will not merge it.

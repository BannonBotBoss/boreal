# T-0085 handoff (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/rain-shadow-ocean`, head `5f4211f`, from main `bd2ef1c` (PR #129). Clock: Pacific, from `TZ=America/Los_Angeles`. Updated 2026-10-26 12:50 PT.

## Board

T-0085 is proposed by grokbot-3 (`tasks/events/2026-10-25T19-30-12-grokbot-3-propose-T-0085.json`, `at` 2026-10-25T19:30:12-07:00). No approve-plan. No claim. No other branch has a claim event. grokbot-3 authored the task and cannot approve its own plan. Rule 16 does not apply: Matthew did not name this task in chat. He asked the bots to keep working through his design issues. That is not an approve-plan of T-0085.

Org discussion https://github.com/orgs/BannonBotBoss/discussions/1 is not writable with this token (GraphQL `discussion` is absent on Organization; repo discussions return 403). The ask for approve-plan is on the pull request, to @Grokbot-1.

No claim event and no complete event. The objectives stay unchecked. The work is on the branch so a reviewer can read it.

## Doing

Sea softening and rain shadow on the existing Rust grid, read back through `weatherAtLatLon`. No second weather path. `precipitation.rs` keeps Manabe condensation. Issue #100's uncited example coefficients are not used.

## Done

- [x] Confirmed T-0085 is unclaimed and has no approve-plan.
- [x] PR #128 compared with merged #129. #129 is the one query (`weatherAtLatLon`, bilinear, any lat/lon, shared `PlanetSim`, globe spin, `climateRaw` only if wasm is absent). #128 is a second path (nearest cell, private half-degree grid, no spin) and adds no rain shadow and no ocean-distance term. Comment posted. PR #128 closed. Branch `grokbot-3/rust-climate-authority` kept.
- [x] Coast distance cached on `Grid` (`refresh_coast`, 4-connected Dijkstra, haversine). Recomputed only when the land-mask stamp changes.
- [x] Ocean weight `exp(−coast_m / L)` in `climate_seed.rs` and in `update_energy`. `L = U τ` from `ocean_decay_length_m` (Held & Suarez 1994 surface time times the belt geostrophic wind). Passed in so `climate_seed` does not import `wind.rs`.
- [x] Upslope term in `hydrosphere/orographic.rs` (Roe 2005 eq. 6), added inside `update_moisture` before Manabe `condense()`. Actual humidity, not `q_sat`. Capped by column water. Zero `dt` adds nothing.
- [x] Wasm rebuilt and is in the tree (`public/wasm/boreal_sim.wasm`, 149213 bytes).
- [x] Transect tests in Rust and in `tests/rain-shadow-ocean.test.ts`.
- [x] Same-pose frames under `tasks/evidence/T-0085/`.
- [x] Skill `notes/skills/rain-shadow.md`.

## How to verify

- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib` — 83 passed, 0 failed (2026-10-26).
- `npx tsx --test tests/rain-shadow-ocean.test.ts` — the two T-0085 tests. Full `npm test`: 837 tests, 823 pass, 0 fail, 14 todo. `npx tsc --noEmit` exit 0.
- `node tasks/evidence/T-0085/capture.mjs before|after` with Vite on port 5275. Query `?nomenu&noprobe&day=15|196&hour=12`.

## Numbers

Game values below were printed by the tests on this tree. Published values are the cited stations. A miss is a no.

| What | Game | Published | Source | Yes or no |
| --- | --- | --- | --- | --- |
| Decay length at 49.79°N | 5390 km | L = U τ, not a station | Held & Suarez 1994, Bull. Amer. Meteor. Soc. 75:1825, surface k_T; U from belt pressure (Peixoto & Oort / Hartmann) and ISO 2533 density at 15 °C | Relationship only |
| Decay length at 50°N | 5571 km | same formula | same | Finite, between 200 km and 8000 km |
| Decay length at the equator | 0 km | belt gradient is symmetric | same | Recorded. Ocean cells still use the ocean seed |
| July−January range, shoreline land, 49.79°N, elevation 0 | 3.25 K | Tofino A 9.4 K (July 14.7 − January 5.3) | ECCC 1981–2010 daily average, climate id 1038205, 49°04'56"N, 125°46'21"W, elev 24.5 m | No. The ocean column is milder than that coastal land station. Shoreline equals the ocean column (3.25 K) |
| Range at 500 km | 7.17 K | no station at this distance on this grid | — | Direction only: larger than the coast |
| Range at 2000 km | 16.98 K | — | — | Direction only |
| Range at 8000 km | 37.50 K | Kenora A 35.7 K (July 19.7 − January −16.0) | ECCC 1981–2010, climate id 6034075, 49°47'25"N, 94°21'55"W, elev 409.7 m | No as a number. Kenora is not 8000 km from the nearest ocean. Direction: past halfway from the ocean column (3.25 K) to the land column (47.53 K) |
| One 6 h step, forced west wind 10 m/s, unsaturated so Manabe rain is 0 | windward 0.635 mm/day, crest 0, leeward 0 | Olympic rain shadow: Forks 3.0 m/yr, Sequim 0.4 m/yr, ratio 7.5 | Minder, Durran, Roe, Anders 2008, Q. J. R. Meteorol. Soc. Washington State Climate Office: Quinault 151.45 in vs Sequim 23.98 in, ratio 6.32, 56 miles | Direction yes (windward wetter; reversing the wind reverses the wet side). Ratio is not a pass. Different mountain. The simplest upslope term has no spillover, so the lee can be 0 |
| `weatherAtLatLon`, 45°N crest, four 6 h steps, model wind | u 3.02 m/s, windward 2.425 mm/day, leeward 0.543 mm/day, ratio 4.46 | same Olympic ratio 7.5 | same paper | Direction yes. 4.46 is not 7.5 |
| `weatherAtLatLon`, 45°N, July−January | water 3.02 K, first land cell 15.99 K, inland 41.98 K | range grows inland | the decay above | Yes for the relationship |

`NORMALS` in `src/core/weather.ts` still says Kenora July 19.2. That table was not edited. The official July daily average used above is 19.7.

Home stand, same pose, `weatherAt(0,0)` after the forest spin (the coarse cell is near procedural water, so the long decay pulls it toward the sea):

| | January noon | July noon |
| --- | --- | --- |
| Before | −6.36 °C, snow falling, 20.5 mm snow-water, rain 0.215 mm/h, cloud 0.93 | 14.39 °C, no snow, rain 0.034 mm/h, cloud 0.75 |
| After | +2.28 °C, snow flag false, 12.75 mm snow-water still on the ground, rain 0.112 mm/h, cloud 0.97 | 6.21 °C, no snow, rain 0.074 mm/h, cloud 0.87, relative humidity 0.93 |

Kenora's published January is −16.0 °C. The home winter moved further from that station. L was not tuned to close the gap.

## Frames

The task's check is the transect. The frame gate for a map is N/A. These four shots are the same camera and the same query, so a person can see the stand. No calibrated look score was run. Rule 11: the resemblance below is uncalibrated and is not a 95% pass.

- `tasks/evidence/T-0085/jan-before.png` — overcast grey-white sky, snow on the ground and on the spruce, bare shrubs, flat light. The sample is snowing.
- `tasks/evidence/T-0085/jan-after.png` — same trees and camera. Sky darker and heavier. Snow still covers the ground and the trees. No flakes in the air. The sample is above freezing, so the snow flag is false, and snow-water is still on the ground, which matches the picture.
- `tasks/evidence/T-0085/jul-before.png` — green grass, leafy canopy, blue sky with scattered clouds.
- `tasks/evidence/T-0085/jul-after.png` — same pose and the same summer leaves. Sky whiter and cloudier. The light is still a summer light. The air in the sample is cooler (6 °C against 14 °C). That cooler air is not a large colour change.
- Samples: `tasks/evidence/T-0085/observations-before.json`, `tasks/evidence/T-0085/observations-after.json`.
- Capture script: `tasks/evidence/T-0085/capture.mjs`.

## Leftovers

- Approve-plan is missing, so the task is not claimed and not submitted.
- Home January is milder than the grid before this change, and further from Kenora. That is the long decay plus water near the home cell. It is recorded as a miss, not adjusted.
- Equatorial L is 0 because the annual belt gradient is symmetric there.
- The lee of a single forced step can be exactly dry. The multi-step query still rains on the lee, less than the windward side.

## Exact next step

@Grokbot-1 writes an approve-plan whose `at` is a real Pacific clock stamp. After that file is on this branch, the claim `at` must be later than that stamp, and only then a complete event that names the skill `rain-shadow`, this branch, and this handoff. grokbot-3 will not write the approve-plan, will not approve the pull request, and will not merge it.

## Needs from another agent

- @Grokbot-1: approve-plan for T-0085 (non-author). Then review and merge the pull request. grokbot-3 will not approve or merge it.

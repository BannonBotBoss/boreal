# T-0085 handoff (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/rain-shadow-ocean`. Climate fix commit `fab121b`, after the merge of pull request #136 (`ea08a0b` on main). Clock: Pacific, from `TZ=America/Los_Angeles`. Updated 2026-10-26 13:54 PT.

## Board

T-0085 was proposed by grokbot-3 (`tasks/events/2026-10-25T19-30-12-grokbot-3-propose-T-0085.json`, `at` 2026-10-25T19:30:12-07:00). grokbot-1 approve-plan is `tasks/events/2026-10-26T13-25-00-grokbot-1-approve-plan-T-0085.json`, `at` 2026-10-26T13:25:00-07:00. Claim is `tasks/events/2026-10-26T13-52-20-grokbot-3-claim-T-0085.json`, `at` 2026-10-26T13:52:20-07:00, later than that approve-plan. Complete is `tasks/events/2026-10-26T13-54-40-grokbot-3-complete-T-0085.json`, `at` 2026-10-26T13:54:40-07:00. grokbot-3 cannot approve or merge this work. grokbot-2 is down until about Oct 28 and is not tagged.

Pull request #136 merged the first sea term. That term warmed the Kenora stand. This branch is the follow-up. The objectives stay unchecked until a non-author approve. The complete event names skill `rain-shadow`, this branch, and this handoff.

## Doing

Keep the sea's softening on true ocean coastline, and keep the windward/leeward rain direction. The Kenora stand in January has to stay at or below the pre-sea-term temperature, below 0 °C, with snow falling.

## Done

- [x] Measured the merged sea term at the stand: January +2.28 °C, snow flag false; July +6.21 °C. Main, before that term, was January −6.36 °C with snow and July 14.39 °C (`tasks/evidence/T-0085/observations-before.json`, `observations-after.json`).
- [x] Tested the lake hunch on the four-degree mask three ways (height above 0, lakes excluded, largest ocean component only). All three gave January +2.28 °C and July +6.21 °C. Punched lake beds at four degrees were 0. Lake of the Woods is not what warmed Kenora. Lakes are still written as land, so a bed below sea level cannot become an ocean source.
- [x] Replaced the surface fetch. `L = h / C_H` with `h` = 1000 m (Stull 1988), `C_H` the existing neutral bulk coefficient, forest `z0` = 1.5 m, measurement height 10 m, `κ` = 0.41. `L` is 21.4 km at every latitude. Held & Suarez `τ` stays in `wind.rs` for the free atmosphere and is not this length.
- [x] Forest boot is one degree (`FOREST_NLAT` = 180). The four-degree centres around the player were ocean. The one-degree centres on the landmass are land.
- [x] Wasm rebuilt (`public/wasm/boreal_sim.wasm`).
- [x] Kenora lock in `tests/rain-shadow-ocean.test.ts`. Ridge direction unchanged (windward 2.425 mm/day, leeward 0.543, ratio 4.46).
- [x] Skill `notes/skills/rain-shadow.md` updated.

## How to verify

- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib` — 86 passed, 0 failed (2026-10-26).
- `npx tsc --noEmit` exit 0.
- `npm test` — 839 tests, 825 pass, 0 fail, 14 todo.
- `node tasks/evidence/T-0085/capture.mjs fixed` with Vite on port 5275. Query `?nomenu&noprobe&day=15|196&hour=12`. `before` and `after` are the earlier pair and should not be overwritten.

## Numbers

Game values below were printed by the tests on this tree. Published values are the cited stations. A miss is a no. No coefficient was fitted to Kenora.

| What | Game | Published | Source | Yes or no |
| --- | --- | --- | --- | --- |
| Surface fetch `L = h / C_H` | 21.4 km at the equator and at 50°N | `h` of order 1 km; `C_H = κ² / ln(z_m/z0)²` | Stull 1988 (daytime mixed layer of order 1 km); FAO-56 eq. 4 and the existing `surface_balance` `ra`; `FOREST_Z0` 1.5 m, Raupach 1994; `κ` 0.41, Högström 1996; `z_m` 10 m, same as `WIND_REF_M` | Relationship only. Not fitted |
| Held & Suarez surface `k_a`, `k_s` | 0.025 and 0.25 day⁻¹, still in `wind.rs` | same | Held & Suarez 1994, Bull. Amer. Meteor. Soc. 75:1825 | Kept for the free atmosphere. Not the surface fetch |
| July−January, shoreline land, 49.79°N, elevation 0 | 3.25 K | Tofino A 9.4 K (July 14.7 − January 5.3) | ECCC 1981–2010 daily average, climate id 1038205 | No. Shoreline equals the ocean column |
| Range at L/2, L, and 4L | 20.67 K, 31.24 K, 46.72 K | land column 47.53 K | the heat capacities already in the grid | Direction yes. 4L is past halfway from the ocean column (3.25 K) to the land column |
| One 6 h step, forced west wind 10 m/s, unsaturated so Manabe rain is 0 | windward 0.635 mm/day, crest 0, leeward 0 | Olympic rain shadow: Forks 3.0 m/yr, Sequim 0.4 m/yr, ratio 7.5 | Minder, Durran, Roe, Anders 2008, Q. J. R. Meteorol. Soc. | Direction yes. Ratio is not a pass |
| `weatherAtLatLon`, 45°N crest, four 6 h steps, model wind | u 3.02 m/s, windward 2.425 mm/day, leeward 0.543 mm/day, ratio 4.46 | same Olympic ratio 7.5 | same paper | Direction yes. 4.46 is not 7.5 |
| `weatherAtLatLon`, near 42.5°N, July−January | water 2.88 K, first land cell 33.04 K, inland 38.26 K | range grows inland | the decay above | Yes for the relationship |
| Kenora stand, January noon, one-degree grid | −18.94 °C, snow falling, 28.67 mm/day, snow-water 86.0 mm | Kenora A January −16.0 °C | ECCC 1981–2010, climate id 6034075, 49°47'25"N, 94°21'55"W | Below 0 °C, snowing, and no warmer than main's −6.36 °C. 2.9 K colder than −16.0 °C. Not a forced match |
| Kenora stand, July noon | 27.50 °C, no snow, 0.216 mm/h | Kenora A July 19.7 °C (`NORMALS` still says 19.2) | same station | A summer, and warmer than the station. No |

`NORMALS` in `src/core/weather.ts` was not edited.

Home stand, same pose. `before` is main without the sea term. `after` is merged #136 (Held & Suarez fetch, four-degree cells). `fixed` is this branch.

| | January noon | July noon |
| --- | --- | --- |
| Before (main) | −6.36 °C, snow falling, 20.5 mm snow-water, rain 0.215 mm/h, cloud 0.93 | 14.39 °C, no snow, rain 0.034 mm/h, cloud 0.75 |
| After (#136) | +2.28 °C, snow flag false, 12.75 mm snow-water still on the ground, rain 0.112 mm/h, cloud 0.97 | 6.21 °C, no snow, rain 0.074 mm/h, cloud 0.87 |
| Fixed (this branch) | −18.94 °C, snow falling, snow-water 86.0 mm, precip 1.194 mm/h, cloud 1.00 | 27.50 °C, no snow, precip 0.216 mm/h, cloud 0.59 |

The seeded stand is land at 370 m, latitude 49.77°N, longitude 65.54°E. That longitude is the existing globe-home hash, not Kenora's −94.36°. The landmass is about a hundred kilometres across, so the ocean shore is tens of kilometres away. With a 21 km fetch the cell is nearly continental. Moving the home longitude was not required and was not done.

## Frames

The climate check is the transect and the Kenora lock. These shots are the same camera and the same query. No calibrated look score was run. Rule 11: the resemblance is uncalibrated and is not a 95% pass.

- `tasks/evidence/T-0085/jan-before.png` — main. Overcast, snow on the ground and on the spruce. The sample is snowing at −6.36 °C.
- `tasks/evidence/T-0085/jan-after.png` — merged #136. Snow still on the ground. The sample is +2.28 °C, so the snow flag is false.
- `tasks/evidence/T-0085/jul-before.png` — main. Green grass, leafy canopy, summer light, 14.39 °C.
- `tasks/evidence/T-0085/jul-after.png` — merged #136. Same summer leaves, cloudier, sample 6.21 °C.
- `tasks/evidence/T-0085/jan-fixed.png` — this branch, January noon. The ground and the spruce are snow-covered. The sky is a flat grey-white overcast. The bound sample is −18.94 °C with the snow flag true and 1.194 mm/h of precipitation. Copies: `/opt/cursor/artifacts/kenora-january.png`.
- `tasks/evidence/T-0085/jul-fixed.png` — this branch, July noon. Green grass, leafy canopy, blue sky with scattered clouds. The sample is 27.50 °C, snow flag false. Copies: `/opt/cursor/artifacts/kenora-july.png`.
- Samples: `tasks/evidence/T-0085/observations-fixed.json`. The in-game read matches the test.
- Capture script: `tasks/evidence/T-0085/capture.mjs` (`before`, `after`, or `fixed`).

## Leftovers

- July at the stand is 27.50 °C against Kenora's 19.7 °C. The land column is a thin soil slab and the one-degree cell is nearly continental. Not fitted.
- January precipitation at the stand is 28.7 mm/day, much wetter than a Kenora January. The snow flag only requires precipitation above 0 while the air is below 0 °C. The amount was not tuned.
- The shoreline range is still the ocean column, 3.25 K, milder than Tofino's 9.4 K.
- The ridge ratio 4.46 is not the Olympic 7.5. Direction is unchanged.
- A non-author approve and merge are still required. grokbot-3 will not approve or merge.

## Exact next step

@Grokbot-1 reviews the follow-up pull request and merges it if the GitHub `test` check is green. grokbot-3 will not approve the pull request and will not merge it.

## Needs from another agent

- @Grokbot-1: review and merge the follow-up. The January and July numbers are in the table above.

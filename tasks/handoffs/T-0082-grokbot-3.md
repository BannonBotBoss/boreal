# T-0082 handoff (grokbot-3)

Step 2 of `notes/design-roadmap.md`. Issues #100 and #101. Author of the task is grokbot-3, so this run does not approve the plan.

## Status

Claimed. grokbot-2 approve-plan is on main (pull request #124, event `2026-10-26T02:59:07-07:00`). That is a non-author approval of the plan. Rule 16 was not used: Matthew's standing notes do not name T-0082. Branch `grokbot-3/rust-climate-authority`. The numbers gate fails (January and July against Kenora), so this is not a complete and not an approve of the work.

## What was built

While `public/wasm/boreal_sim.wasm` loads, temperature, humidity, wind, rain, and snow at the player are the home cell of the Rust planet grid (`src/core/climateAuthority.ts`, read by `climate`, `windAt`, and `weatherAt`). `climateRaw` runs only when that file will not load. The two are not mixed. `startForestClimate` runs before `startup`, and `initWeather` follows a successful bind, so the first frame is one source.

The grid is the globe's boot (`bootGlobe` / `grid_boot`), half a degree (360×720), nearest cell. The player is `planet.home` (latitude 49.77, seeded longitude near 65.5°E for seed 1400), not Kenora's −94.36. Rust northward wind is flipped onto world +z (south). Snow is still below 0 °C only. The 35 °C and ±15 °C sketches are not used.

The cloud plane is sampled and not painted. `update_clouds` at dt = 0 is an instant diagnosis (about 1 on the August home cell). The globe spins 8 × 6 h before it trusts cloud (`SPINUP`). Feeding that 1 laid a grey deck on a morning with no rain. `weatherAt.cloud` stays 0 until a later step lets weather move.

## How to verify

1. `npx tsc --noEmit` — exit 0 on this run.
2. `npm test` — 809 tests, 795 pass, 0 fail, 14 todo. The T-0082 cases are in `tests/planet-budget.test.ts`, with the solar test that treats loaded wasm as the source (worst difference under 1e-9).
3. No Rust file changed, so `cargo test` was not run.
4. Frame: headless Chrome, `http://127.0.0.1:5173/?view=ground&nomenu&noprobe&hour=8`, wasm present and the same file moved aside. Sky band y 30–200 on the 1280×720 still, 8³ sRGB histogram intersection (rule 11). Same morning scored 0.989. The unspun-cloud trial scored 0.36 against that before frame (known mismatch). Sky luminance 200.4 before, 199.8 after. Ground band 0.974.

## Numbers

Home cell, noon, half-degree boot. Printed by the T-0082 Kenora test. Game value is not overwritten to match the table.

| Quantity | Game | Published | Source | Match |
| --- | --- | --- | --- | --- |
| January air | −20.60 °C | −16.0 °C | `NORMALS.temp[0]`, Kenora A 1981–2010, ECCC | No. 4.6 K cold. |
| July air | 26.92 °C | 19.2 °C | `NORMALS.temp[6]`, same table | No. 7.7 K warm. Ocean moderation is roadmap step 5. |
| January relative humidity | 0.75 | 0.72 | Game is `RH_SEED` (Peixoto & Oort 1996). Published is `NORMALS.rh` January, 72% at 1500 LST | Close. Not the monthly table. |
| July relative humidity | 0.75 | 0.57 | Same, `NORMALS.rh` July | No. |
| January wind | 2.44 m/s | 3.6 m/s annual mean at 10 m | `NORMALS.wind` | Same order. Not a station month. |
| July wind | 14.76 m/s | 3.6 m/s | `NORMALS.wind` | No. |
| Rain at the boot | 0 mm/h | January 27 mm / 30.44 d ≈ 0.89 mm/day | `NORMALS.precip[0]`. The plane is 0 because `update_moisture` is called with dt = 0 | No. |
| January snow store | 30 mm water | Threshold 0 °C already matches #100. Depth is `SNOW_SEED_MM`, marked game calibration | `climate_seed.rs` | Direction yes (store in January, none in July). Magnitude is the seed, not a snow course. |
| July snow | 0, and the flag is false | No snow expected above 0 °C with no rain | Same 0 °C split | Yes for the flag. |
| Solar budget | worst difference under 1e-9 over 400 points | The existing column (`solar` / `shortwave` against `solar_cell`) | `tests/planet-budget.test.ts` | Yes. Loaded wasm is the source. The TypeScript copy is the fallback. |
| 35 °C and ±15 °C | not used | Issue sketches, rejected by roadmap conflict 9 | | |

## Frame

N/A as a change Matthew would see on the morning the game opens (day 227, 08:00). The picture stays inside the histogram above. Rain is 0 and snow is false on that morning either way, so nothing falls and the ground has no snowpack (`swe` 0). The numeric check named with that N/A is the solar parity (under 1e-9) plus the sky-band luminance (200.4 against 199.8).

A 95% comparison with a generated reference of a real August morning was not made. No reference frames were generated. The Kenora temperature rows already fail, so the task stays open without that reference.

## Leftovers

- The near grid still steps. It does not drive the player read while the wasm is bound. Roadmap step 4 should make that cell relax toward this climate, and should be where cloud is allowed to move.
- No diurnal cycle. The Rust air temperature is a daily value. The old formula had an afternoon peak and a night minimum.
- Boot cloud is unspun and is not painted. See above.
- `cellAir` in `src/core/planet/hydrosphereBudget.ts` calls `climate()`. A bound sim changes that anomaly (rust home minus the Kenora month mean). Not this task's player read.
- The date jump re-boots a half-degree grid (about a second).
- Fog has no plane, so fog is 0 while the wasm is bound.
- T-0085, T-0086, and T-0087 wait on this task.

## Needs from another agent

- Nothing for the plan. grokbot-2 already approved it.
- A complete event is not written. When the January and July temperatures match the Kenora table (roadmap step 5 is the ocean term), a later claimant can complete, and an agent other than that claimant approves the work.
- A reference for the 95% frame gate only if that later run wants to complete. Prompt: an eye-level August morning in a boreal forest near Kenora, broken cloud, no rain, no snow on the ground.

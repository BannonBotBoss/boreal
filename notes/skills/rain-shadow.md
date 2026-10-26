# Skill: rain shadow and the sea's reach inland

When to use: the ocean's seasonal anomaly dying out with distance from water, and extra rain where the wind climbs a ridge. One planet grid, read through `weatherAtLatLon`. T-0085, issue #100. Issue #99 is the seasonal-habitat context; this skill does not score habitat, vegetation seasons, or migration.

## Steps
1. Read the weather with `weatherAtLatLon` in `src/core/planetWeather.ts`. The forest player is that query. Do not add a second climate function, a private grid, or a wasm plane. `LAYOUT_VERSION` stays where T-0082 left it. `climateRaw` answers only when the wasm is absent.
2. Coast distance is a cache on `Grid`, not a plane. `refresh_coast` in `rust/boreal-sim/src/grid.rs` runs a 4-connected Dijkstra on the land mask (`LAND` below 0.5 is water, distance 0). Steps are haversine metres with `EARTH_RADIUS`. An FNV stamp of the binary mask skips the walk when the mask has not changed. Call it from `initialize`, `boot`, and `update_energy`.
3. The decay length is `ocean_decay_length_m` in `atmosphere/wind.rs`. Steady advection and relaxation give `exp(−x/L)` with `L = U τ`. `U` is the friction-reduced geostrophic speed of the annual pressure belts (`belt_pressure`, density `P0 / (RD × 288.15)`, ISO 2533 at 15 °C). `τ` is the Held & Suarez 1994 (Bull. Amer. Meteor. Soc. 75:1825) surface Newtonian time: `k_T(σ=1) = k_a + (k_s − k_a) cos⁴ φ`, `k_a = 1/40 day⁻¹`, `k_s = 1/4 day⁻¹`. At the equator the belt gradient is symmetric, so `L` is 0 and land there uses the continental seed. Ocean cells stay on the ocean seed.
4. `maritime_weight` and `maritime_air` live in `climate_seed.rs`. Weight is 1 on water and `exp(−coast_m / L)` on land. `seed_cell` blends sea air and land air with that weight, then the existing bucket, snow, and humidity. `update_energy` writes the same blend, then the existing ICAO lapse. `climate_seed` must not import `wind.rs` (`wind` imports `grid`, and `grid` imports `climate_seed`). Pass `L` in.
5. Rain shadow is `hydrosphere/orographic.rs`, called from `update_moisture` before Manabe `condense()`. Roe 2005 (Ann. Rev. Earth Planet. Sci. 33:645, eq. 6; Sawyer 1956, Smith 1979): `S = ρ q (u·∇z) exp(−z/H_m)` when the wind climbs, else 0. `H_m` is the existing `VAPOUR_SCALE_HEIGHT` (2000 m). Use the cell's specific humidity, not `q_sat`, so a dry column cannot rain the saturated upper bound. Cap the dump by the column's water, remove it from `q`, and add it to rain before the bucket and snow split. Centred slopes match `wind.rs` (`cos` of latitude floored at 0.02). A zero time step adds nothing, so boot's `update_moisture(0)` stays dry of this term. Do not replace `precipitation.rs`.
6. Rebuild `public/wasm/boreal_sim.wasm` (`npm run build:wasm`, target `wasm32-unknown-unknown`) and commit it. The TypeScript tests load that file.
7. Gates: `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib` and `npx tsx --test tests/rain-shadow-ocean.test.ts`. The ridge test forces a crest and asserts windward rain greater than leeward rain through `weatherAtLatLon`. The seasonal test asserts the July-minus-January range grows from open water to the coast to inland. Same-pose frames, when the forest picture is the subject, go under `tasks/evidence/T-0085/` via `node tasks/evidence/T-0085/capture.mjs before|after`.

## Checks that proved it
- Decay length: equator 0 km, 50°N 5571 km. At 49.79°N, `L` is 5390 km.
- Pure seed, July day 196 minus January day 15, 49.79°N: coast 3.25 K (equals the ocean column), 500 km 7.17 K, 2000 km 16.98 K, 8000 km 37.50 K, full land column 47.53 K. The range rises with distance. 8000 km is past halfway from the ocean column to the land column.
- Environment and Climate Change Canada 1981–2010 daily averages: Tofino A, climate id 1038205, July 14.7 °C minus January 5.3 °C is 9.4 K. Kenora A, climate id 6034075, July 19.7 °C minus January −16.0 °C is 35.7 K. The game coast (3.25 K) is milder than Tofino. 37.50 K is not Kenora: Kenora is not 8000 km from the nearest ocean. Both comparisons are a no.
- One 6 h Rust step, west wind 10 m/s, unsaturated so Manabe rain is 0: windward 0.635 mm/day, crest 0, leeward 0. Reversing the wind wets the other face.
- `weatherAtLatLon` after four 6 h steps on a 45°N crest, model westerlies: `u` 3.02 m/s, windward 2.425 mm/day, leeward 0.543 mm/day, ratio 4.46. Minder, Durran, Roe and Anders 2008 (Q. J. R. Meteorol. Soc.) give Forks 3.0 m/yr and Sequim 0.4 m/yr, ratio 7.5, on the Olympics. That mountain is not this ridge. Direction yes. The ratio is not a numeric pass. The one-step lee of 0 is the model omitting hydrometeor spillover.
- Same query at 45°N: water 3.02 K, first land cell 15.99 K, inland 41.98 K. Monotonic.
- `npx tsc --noEmit` exit 0. `npm test` 837 tests, 823 pass, 0 fail, 14 todo. Rust lib 83 passed, 0 failed.

## Mistakes to avoid
- A second weather path, including a private half-degree grid. PR #128 was that path. PR #129's `weatherAtLatLon` is the query.
- Issue #100's uncited example coefficients (a 35° span, ±15°, a humidity percentage). Do not fit `L` or the Olympic ratio to a station.
- Editing `NORMALS` or `climateRaw` so Kenora matches. The home cell on the coarse forest grid sits near procedural water, so a long `L` makes its winter milder and moves it further from Kenora's −16 °C January. Record that. Do not retune.
- Importing `wind.rs` from `climate_seed.rs`. Compute `L` in the wind module and pass it in.
- Replacing Manabe condensation, or adding orographic rain on a zero time step.
- Calling a magnitude a pass when the published place is a different geometry. Label the miss.
- Treating an uncalibrated look at the forest frames as the 95% gate. The task's check is the transect. A frame score without a calibrated metric stays uncalibrated.

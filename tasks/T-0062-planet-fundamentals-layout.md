---
id: T-0062
title: Reorganise rust/boreal-sim into the planet_fundamentals tree from issue #46
author: grok
scratch: false
research: false
skill: rust-wasm-planet-budgets
tags: [planet, rust]
credits: 30
---

# T-0062 Planet fundamentals layout

**Status: completed by grokbot-3 (2026-10-25 11:20 PT) on grok's approve-plan for Matthew (2026-10-23 13:22 PT).** Claim 11:09 PT. Not a new approve-plan. Not self-approved. Branch `grokbot-3/planet-fundamentals`, commit `be3fbed`.

Issue #46 (Matthew, Bannon-github, 2026-10-23 12:27:56 PT), "Rust structure". He named a `planet_fundamentals` tree: `energy/`, `hydrosphere/`, `atmosphere/`, `surface/`, plus `climate_seed.rs`, `planet_initialization.rs`, and `planet_update.rs`. The issue body is quoted in the approve-plan event. This task is that layout only.

## Already covered (link, do not redo)
- **T-0061** (`rust/boreal-sim`, on main, commits `2ef3cbb`, `a912574`, `fd65b8d`) already ports the maths. Its modules are flat and named for issue #43: `solar_budget.rs`, `surface_budget.rs`, `hydrosphere_budget.rs`, `atmosphere_budget.rs`, `climate_seed.rs`, `update_energy.rs`, `update_moisture.rs`, `update_clouds.rs`, `update_wind.rs`, `grid.rs` (`rust/boreal-sim/src/lib.rs`). That is not the tree in #46.
- **T-0057, T-0058, T-0059** (on `grok/board-loop`, issue #43) are the TypeScript globe layers (`src/core/planet/solarBudget.ts`, `hydrosphereBudget.ts`, `surfaceBudget.ts`, `atmosphereBudget.ts`). They say the `.rs` names are module names and the tree is TypeScript. They do not build this folder layout. Leave their globe drawing to them. PR #48 is T-0057's implementation; do not edit it here.
- **T-0063** is the boot order (issue #47). This task only moves files. If T-0063 has already reordered `Grid::seed`, the move keeps that order.

## Prior art (move and split; no new physics)
Every formula stays the one already in the crate, which is the port of `src/core/weather.ts` pinned by `tests/planet-budget.test.ts` (parity to 1e-9). Do not add a second solver, Berger 1978, or another zonal model. `climate_seed.rs` already uses the Budyko 1969 / North & Coakley 1979 balance as a seed (T-0061's recorded deviation from the "no zonal EBM" line in T-0057). Move that file. Do not replace it and do not delete the deviation note.

| #46 file | move or split from | cited source already in the port |
|---|---|---|
| `energy/solar_budget.rs` | `solar_budget.rs` | NOAA GML after Spencer 1971; Kasten & Young 1989; Kasten & Czeplak 1980; `AIR.S0` Kopp & Lean 2011 |
| `energy/albedo.rs` | albedo in `surface_budget.rs` and `climate_seed::planetary_albedo` | Oke 1987 Table 1.1; Budyko 1969 ice albedo |
| `energy/longwave.rs` | longwave terms in `solar_budget.rs` | Brutsaert 1975; Crawford & Duchon 1999; `AIR.sigma` CODATA 2018; OLR A,B North & Coakley 1979 |
| `energy/energy_update.rs` | `update_energy.rs` | bulk aerodynamic exchange as in `weather.ts` (Monin–Obukhov neutral form). Air temperature stays the climatological field |
| `hydrosphere/evaporation.rs` | evaporation in `hydrosphere_budget.rs` / `update_moisture.rs` | Penman–Monteith (Monteith 1965; FAO-56) |
| `hydrosphere/precipitation.rs` | condensation and rain in `update_moisture.rs` | the existing port (near field remains Kessler 1969 in `weather.ts`) |
| `hydrosphere/humidity_column.rs` | `q`, `pw`, `qsat` | Bolton 1980 |
| `hydrosphere/sst.rs` | `sst` plane | climatological seed already in `Grid::seed` |
| `hydrosphere/soil_moisture.rs` | bucket | Manabe 1969, `HYDRO.bucketMm` 150 mm, as T-0058 |
| `hydrosphere/ice_fraction.rs` | `ice_fraction` | the existing function of sea temperature |
| `atmosphere/pressure.rs` | `atmosphere_budget.rs` pressure | hydrostatic form of `climate()`; `AIR.p0` 101325 Pa ISO 2533; `AIR.Rd` 287.05; hypsometric sea-level pressure Wallace & Hobbs 2006 |
| `atmosphere/wind.rs` | `update_wind.rs` | geostrophic wind, `f = 2 Ω sin φ`, `AIR.omega` 7.2921e-5 |
| `atmosphere/instability.rs` | `vertical_instability` | Manabe & Strickler 1964 test already used by the port |
| `atmosphere/cloud_fraction.rs` | `update_clouds.rs` fraction | Sundqvist 1989 |
| `atmosphere/cloud_optical_depth.rs` | optical depth in `update_clouds.rs` | Stephens 1978 |
| `surface/land_sea_mask.rs` | host-filled `land` plane | `src/world/globe/planet.ts` `sampleSurface`: Musgrave 1989 ridged multifractal + fBm, land share 0.292 (ETOPO1, Eakins & Sharman 2012). Do not generate a second mask in Rust |
| `surface/heat_capacity.rs` | `LAND_HEATCAP` / `OCEAN_HEATCAP` | ocean 4.18e6 J/m³/K (Wallace & Hobbs 2006) × 50 m; land 2.0e6 J/m³/K (Oke 1987 Table 2.1) × 0.5 m |
| `surface/roughness.rs` | `z0` in `cell_surface` | Oke 1987; Stull 1988; water 0.0002 m, forest 1.5 m |
| `surface/elevation.rs` | host-filled `elev` plane | same `sampleSurface` as the mask. Do not add a second noise planet |
| `surface/vegetation_fraction.rs` | none (stub) | Matthew marked `// later`. The file says it is later and does not grow a canopy. T-0058 owns reading `surfaceColour`'s forest weight when that layer is drawn |
| `climate_seed.rs` | `climate_seed.rs` | Budyko 1969; North & Coakley 1979; RH seed Peixoto & Oort 1996 |
| `planet_initialization.rs` | `grid_init` + `Grid::seed` | the ordered fill. T-0063 defines the order |
| `planet_update.rs` | `Grid::step` | the per-tick advance already in `grid.rs` |

Path: `rust/boreal-sim/src/planet_fundamentals/`. The wasm exports `grid_init`, `grid_seed`, `grid_step` keep their signatures (`src/core/planetBudget.ts`).

## Objectives
- [x] `rust/boreal-sim/src/planet_fundamentals/` matches the issue #46 tree, each file a move or split from the table above, and `cargo test` stays green.
- [x] `vegetation_fraction.rs` is the `// later` stub. Land and elevation stay inputs from `planet.ts`. `tests/planet-budget.test.ts` still matches `weather.ts` to 1e-9, and the wasm export names are unchanged.
- [x] `src/core/planetBudget.ts`, `rust/README.md`, and `notes/skills/rust-wasm-planet-budgets.md` name the new paths. No second set of formulas.

## Acceptance
The crate's source tree is the layout in issue #46, and the numbers are still the T-0061 port of `weather.ts`. Issue: https://github.com/Bannon-github/boreal/issues/46

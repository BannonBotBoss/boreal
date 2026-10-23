---
id: T-0063
title: Run issue #47's boot order before the globe renders
author: grok
scratch: false
research: false
skill: false
tags: [planet, globe]
credits: 30
---

# T-0063 Globe boot order

Issue #47 (Matthew, Bannon-github, 2026-10-23 12:29:54 PT), "order". He listed the sequence the globe runs before it renders, from the land/sea mask through finalize, then render. The issue body is quoted in the approve-plan event. This task is that order only.

## Already covered (link, do not redo)
- **T-0061** fills a grid, but not in this order, and it never starts the globe. `Grid::seed` (`rust/boreal-sim/src/grid.rs`) assumes the host already wrote `land` and `elev`, then writes temperature, soil, humidity, SST, and ice together, then clouds, wind, `update_energy(1.0)`, and `update_moisture(0.0)`. `update_energy(self, 1.0)` integrates surface temperature for one second during the seed. `src/world/globe/globeView.ts` `startGlobe` does not call `PlanetSim` (no `loadPlanetSim` under `src/world/globe/`). The task file says globe tile wiring is not done.
- **T-0057, T-0058, T-0059** draw per-cell layers on the existing tile material and are pure functions of `(seed, day, hour, direction)` with no spin-up. They own the drawing. This task fills state before the first frame and does not add a layer.
- **T-0062** is the `planet_fundamentals` folder move (issue #46). Prefer calling `planet_initialization` once that file exists. Until then, reorder `Grid::seed` and keep the wasm names. A later T-0062 move must not reshuffle this order.

## Prior art (call what exists; no new physics)
Boot is one pass. It does not advance the clock and it does not integrate `Ts`. The one-second `update_energy` call inside today's `seed` does not belong in the boot pass. Ongoing advance stays `Grid::step` / `planet_update` (T-0062).

| #47 step | existing call |
|---|---|
| Generate land/sea mask | `planet.ts` `sampleSurface` land fraction, written through `PlanetSim.setLand`. Musgrave 1989 + fBm, land share 0.292 (ETOPO1). Not a second mask |
| Generate elevation + roughness | elevation from the same `sampleSurface`. Roughness from `surface_budget::cell_surface` `z0` (Oke 1987; Stull 1988; water 0.0002 m, forest 1.5 m) into the `rough` plane |
| Seed climate bands | `climate_seed` (Budyko 1969 / North & Coakley 1979 zonal balance, already the T-0061 seed). Do not add another |
| Seed SST + soil moisture + humidity | SST and specific humidity from that seed; soil moisture from the Manabe 1969 bucket (`HYDRO.bucketMm` 150 mm), the same split T-0058 names |
| Seed cloud fraction + optical depth | `update_clouds` (Sundqvist 1989 fraction, Stephens 1978 optical depth) |
| Compute solar budget | `solar_budget::solar` / `shortwave` (NOAA after Spencer 1971; Kasten & Czeplak 1980) |
| Compute surface absorption | absorbed shortwave already returned by `solar_budget::budget` (`q_absorbed`). Write the diagnostic. Do not step `Ts` |
| Compute pressure | `atmosphere_budget::surface_pressure`, hydrostatic, `AIR.p0` ISO 2533 |
| Compute wind | `update_wind` geostrophic wind, `f = 2 Ω sin φ` |
| Compute hydrosphere flows (evap, precip) | Penman–Monteith evaporation and the existing condensation/bucket rain in `update_moisture`, as diagnostics for this instant |
| Compute atmosphere updates (clouds, humidity) | refresh cloud fraction, optical depth, and the humidity column (`qsat`, Bolton 1980; precipitable water) from the flows just computed |
| Finalize world state | the planes above are finite and readable through `PlanetSim.plane` before anyone draws |
| Render globe | `globe.start()` in `startGlobe`. Shared `createGlobe` uses the same fill before its first frame |

Entry: `src/world/globe/entry.ts` loads `startGlobe` when `?view=globe`. Both that path and the shared globe call the same ordered function.

## Objectives
- [ ] `startGlobe` and shared `createGlobe` run the issue #47 list through finalize before the first frame.
- [ ] Each step is the existing call in the table. A test fails if the order changes. Boot does not advance time and does not integrate `Ts`.
- [ ] `npm test` and `npx tsc --noEmit` pass. Layer drawing stays T-0057..T-0059.

## Acceptance
Booting into the globe fills the existing planet fields in Matthew's order, then renders. Issue: https://github.com/Bannon-github/boreal/issues/47

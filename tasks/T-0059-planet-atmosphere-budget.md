---
id: T-0059
title: Per-cell atmosphere budget driving the existing cloud shell, with geostrophic wind from the pressure gradient
author: grok
scratch: false
research: true
skill: false
tags: [globe, climate, wind]
credits: 39
---

# T-0059 Planet atmosphere budget

Issue #43 (Matthew, Bannon-github, 2026-10-23 10:09 PT). He asked for a per-cell atmosphere: cloud fraction, cloud optical depth, pressure, wind from the pressure gradient plus Coriolis, and vertical instability. The names `atmosphere_budget.rs`, `update_clouds.rs`, and `update_wind.rs` are module names. The tree is TypeScript. Not claimed here.

## Already built
The globe cloud shell is `atmosphere.ts` `CLOUDS`: a 2.5 km shell, 900 km cells, octave counts per tier `[8, 6, 5, 4, 2, 0]`. That shell is what hides the ground at 3000 m on the standalone globe. T-0056 opens it there. This task feeds it a cloud fraction. It does not add a second shell.

Pressure in the far field is already hydrostatic: `climate()` uses `p = p0 exp(-g (z + elevation) / (Rd T))` with `AIR.p0` 101325 Pa (ISO 2533) and `AIR.Rd` 287.05. Wind there is a seeded synoptic vector, one Kenora speed (`NORMALS.wind` 3.6 m/s), not a gradient. The near grid already nudges toward geostrophic balance (`weather.ts` `stepSlices`: Coriolis on the ageostrophic part, `f = 2 * AIR.omega * sin(lat)`, `AIR.omega` 7.2921e-5 rad/s). Vertical instability on that grid is `convectiveAdjust` (Manabe & Strickler 1964). Cloud water on that grid is Kessler 1969. Those stay the local weather. Do not replace Stam (1999) or Kessler with a planet-sized fluid solver.

## Technique
A pure function of `(seed, day, hour, unit direction)`, same rule as `climate()`. Pressure is the hydrostatic term, evaluated at the cell (latitude changes the climatological temperature it already uses; do not invent a new gas constant). Geostrophic wind is `Vg = |∇p| / (ρ f)` with `f = 2 Ω sin φ`, `Ω` from `AIR.omega`, `ρ = p / (Rd T)` as in `surfaceBalance`, and `∇p` taken from neighbouring cells of this same function. At the equator `f` is 0; the wind there stays the seeded synoptic vector from `climate()`, which is the existing guard rather than a division by zero. Cloud fraction and optical depth scale the existing `CLOUDS` density (the tier still picks the octave count, and Minimum stays at 0). Vertical instability reuses `convectiveAdjust`'s test (potential temperature decreasing with height) on the climatological profile, and does not add a new convection scheme. Module `src/core/planet/atmosphereBudget.ts`.

## Calibration
- Known match: `f` at `PLANET.home` latitude 49.77° N is `2 * AIR.omega * sin(49.77°)`. A stated zonal gradient of 0.001 Pa/m at that latitude returns `Vg = 0.001 / (ρ f)` with `ρ` from the hydrostatic `p` and `T` at sea level. The test prints both sides.
- Known mismatch: the globe shell does not read a per-cell cloud fraction. T-0056 still owns opening the deck at 3000 m. T-0057 owns the solar numbers. T-0058 owns the bucket and the land mask.

Gate: the geostrophic case above matches to 1%. A Minimum-tier frame still draws 0 cloud octaves. `npm test` and `npx tsc --noEmit` pass.

## Objectives
- [ ] Per direction: cloud fraction, optical depth, pressure, and geostrophic wind from the hydrostatic `climate()` pressure and `f = 2 Ω sin φ`. Equator keeps the synoptic vector. No new fluid solver.
- [ ] The existing `CLOUDS` shell reads that cloud fraction. Octave counts stay the tier row, Minimum at 0. Vertical instability reuses the `convectiveAdjust` test.
- [ ] The 0.001 Pa/m case at 49.77° N matches `Vg = |∇p| / (ρ f)` to 1%. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
The cloud shell and the wind can be driven by a seeded per-cell atmosphere, and the local Stam/Kessler grid is still the near field. Issue: https://github.com/Bannon-github/boreal/issues/43

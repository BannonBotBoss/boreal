---
id: T-0058
title: Per-cell hydrosphere and surface budgets seeded from the existing bucket, land mask, and climatology
author: grok
scratch: false
research: true
skill: false
tags: [globe, climate, water]
credits: 39
---

# T-0058 Planet hydrosphere and surface budgets

Issue #43 (Matthew, Bannon-github, 2026-10-23 10:09 PT). He asked for a hydrosphere budget (evaporation, precipitation, soil moisture, sea-surface temperature, ice fraction, humidity column) and a surface budget (land and sea fraction, heat capacity, roughness, vegetation, snow), procedurally seeded so there is no long spin-up. The names `hydrosphere_budget.rs`, `surface_budget.rs`, and `climate_seed.rs` are module names. The tree is TypeScript. Not claimed here.

## Already built
Continents and basins are `planet.ts`: ridged multifractal (Musgrave 1989) plus four octaves of fBm, sea level set so the land share is 0.292 (ETOPO1). The home region is the game's own `surfaceAt`. Do not add a second noise planet for `climate_seed`.

The column is `weather.ts`. The bucket is Manabe 1969, field capacity `HYDRO.bucketMm` 150 mm, overflow to runoff in `stepSlices`. Snow uses the degree-day factor `HYDRO.ddf` (Hock 2003). Evaporation is `surfaceBalance().E` (Penman–Monteith, limited by bucket water). Humidity is `qsat` (Bolton 1980). Roughness and albedo are `SURFACE` (`z0`, Oke 1987). The far field is `climate()`: a pure function of seed, day, hour, and height, from Kenora normals, the ISA lapse, and a seeded synoptic wind. It is one site, not a planet grid. `update_moisture` in his list is this bucket step, not a new integrator.

## Technique
Pure functions of `(seed, day, hour, unit direction)`, same rule as `climate()`: no stored spin-up. Land and sea come from `sampleSurface` (`kind`, `level`, `home`). Soil moisture, evaporation, precipitation, ice, and snow are the bucket and the degree-day melt, seeded from `climate()` at that latitude (the monthly normals, evaluated at the cell, not a second climate table). Sea-surface temperature and the humidity column use that same climatology over water (`SURFACE.water`). Heat capacity and roughness come from `SURFACE` for the cell's kind. Vegetation fraction is the land colour's forest weight already in `surfaceColour` (spruce / mixed / temperate); he marked vegetation "later", so this task reads that weight and does not grow a new canopy model. Modules `src/core/planet/hydrosphereBudget.ts` and `src/core/planet/surfaceBudget.ts`. Drawn as globe layers on the T-0057 rule: off when `CLOUDS.octaves` is 0. The near-field `stepSlices` grid stays the local weather.

## Calibration
- Known match: a column at field capacity 150 mm that receives 10 mm drops 10 mm to runoff and stays at 150, the overflow already in `stepSlices`. `HYDRO.bucketMm` stays 150 (Manabe 1969).
- Known mismatch: the globe has no per-cell soil moisture, ice fraction, or roughness. T-0056 is the blank sheet. T-0057 is the solar driver these fields may call for evaporation. Do not reimplement `solar()`.

Gate: the overflow test above, and a water direction versus a land direction that differ in roughness (`SURFACE.water.z0` 0.0002 m versus `SURFACE.forest.z0` 1.5 m). `npm test` and `npx tsc --noEmit` pass.

## Objectives
- [ ] Hydrosphere per direction: evaporation, precipitation, soil moisture, sea-surface temperature, ice fraction, humidity column, from the Manabe bucket, `qsat`, and `climate()`. No spin-up loop.
- [ ] Surface per direction: land and sea fraction, heat capacity, roughness, snow, and the existing vegetation weight, from `sampleSurface` and `SURFACE`. No second continent generator.
- [ ] Both draw as globe layers, off when `CLOUDS.octaves` is 0. The 150 mm bucket overflows by the excess. Water and forest roughness stay the `SURFACE` pair. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
Planet cells carry the water and surface fields the Kenora column already steps, seeded, without a new Earth. Issue: https://github.com/Bannon-github/boreal/issues/43

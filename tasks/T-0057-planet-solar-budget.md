---
id: T-0057
title: Per-cell solar budget on the existing globe, seeded, drawn only while the tier can take the layer
author: grok
scratch: false
research: true
skill: false
tags: [globe, climate, solar]
credits: 39
---

# T-0057 Planet solar budget

Issue #43 (Matthew, Bannon-github, 2026-10-23 10:09 PT). He asked for a solar energy budget on each surface cell: zenith from time of year, time of day, and axial tilt; top-of-atmosphere insolation; cloud attenuation and albedo; absorbed, reflected, and outgoing longwave. The file name he wrote (`solar_budget.rs`) is a module name. The tree is TypeScript. Not claimed here.

## Already built
`src/core/weather.ts` `solar()` is the NOAA General Solar Position Calculations after Spencer 1971: declination (the tilt for this day), equation of time, zenith, and TOA `AIR.S0 * (r0/r)^2 * cosZ` with S0 = 1361 W/m² (Kopp & Lean 2011). `shortwave()` is Meinel & Meinel transmittance and Kasten & Czeplak cloud attenuation `1 − 0.75 C^3.4`. `surfaceBalance()` already stores the column terms: net radiation, longwave with Brutsaert 1975 emissivity and Crawford & Duchon 1999 cloud, ground heat as FAO-56, latent heat as Penman–Monteith, sensible heat as the residual. Albedo is `SURFACE` (Oke 1987). Outgoing longwave uses `AIR.sigma` (CODATA 2018).

That function is one Kenora column (`SITE`), not a field on the globe. T-0022 still owns the sky dome, which calls `sunPosition(hour)` and drops `dayAt`. Do not move that call in this task. Berger 1978 is the long-term orbital solution (eccentricity, obliquity, precession). This clock is a day of the year. Do not add Berger.

Budyko (1969) and Sellers (1969) are the zonal energy-balance climate models (ice-albedo feedback, meridional diffusion). The repo's balance is the column above. Extend the column. Do not add a second, zonal model beside it.

## Technique
A pure function of `(seed, day, hour, unit direction)`, the same shape as `climate()` (nothing stored, no spin-up). Zenith and TOA come from `solar()` at that direction's latitude and longitude. Cloud fraction, until T-0059 lands, is the caller passing a number (the globe's current cell, or 0 in the unit test). Albedo comes from the existing surface: `sampleSurface` / `surfaceColour` over land, `SURFACE.water.albedo` over ocean. Absorbed, reflected, and outgoing longwave use `shortwave` and the longwave term already inside `surfaceBalance`. Module name `src/core/planet/solarBudget.ts`. The globe draws it as one extra layer on the existing tile material (`tile.ts`), dropped when the tier's cloud-octave row is 0 (`CLOUDS.octaves`, Minimum), which is how many layers this hardware row already keeps. No new mesh and no new quality ladder.

## Calibration
- Known match: `solar(day, hour, lat, lon)` TOA at 49.77° N, the latitude already in `PLANET.home`. The new function returns that same TOA at the home direction. A second latitude (the equator at noon, day 172) stays non-negative and follows `cosZ`.
- Known mismatch: no globe attribute carries Q_absorbed. The 3000 m sheet is T-0056, not this layer.

Gate: a node test prints both TOA values and they match. The layer is absent at Minimum and present at a tier whose `CLOUDS.octaves` entry is above 0. `npm test` and `npx tsc --noEmit` pass.

## Objectives
- [ ] `solarBudget` per direction: zenith, TOA, absorbed, reflected, outgoing longwave, all from `solar`, `shortwave`, and the longwave term in `surfaceBalance`. No Berger and no zonal EBM.
- [ ] Seeded from `sampleSurface` and `SURFACE`. No stored spin-up. T-0022's sky call stays.
- [ ] One globe layer, off when `CLOUDS.octaves` is 0, on when it is not. The home-direction TOA matches `solar()`. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
A cell on the globe can show the instantaneous solar budget the Kenora column already computes. Issue: https://github.com/Bannon-github/boreal/issues/43

# Skill: Rust gas column, planetary interior/exobase, shortwave RT glint, and species biogeography audit

When to use: auditing or fixing Boreal's Rust atmospheric gas column (`rust/boreal-sim/src/gas.rs`), radial interior / plasmasphere profile (`rust/boreal-sim/src/interior.rs`), gas-fed shortwave radiative transfer & Cox-Munk glint (`rust/boreal-sim/src/rt.rs`, `rust/boreal-sim/src/lib.rs` `rt_point`), through-planet `Axis` readout (`src/world/globe/axisView.ts`), or wildlife species biogeography / population-cycle census (`rust/boreal-sim/src/species.rs`, `data/earth/species-density.json`, `src/core/landingRoster.ts`, `src/render/landingCast.ts`).

## Steps
1. **Audit `gas.rs` thermodynamics, upper-atmosphere continuity, exospheric gravity, and `column_above` cost via live WASM (`PlanetSim`).**
   - Compare `gasColumn(0, 0, 0, 422.8)` vs humid `gasColumn(0, 0, 0.02, 422.8)`: verify sea-level pressure remains `101,325 Pa` (Dalton's law displacement) and humid density is **lighter** (`~1.210 kg/m³`, `-1.21%` via virtual temperature `T_v = T(1 + 0.608 q)`), never heavier.
   - Sweep across `119.95 -> 120.00 km` (`O2` photochemical handoff) and `85.9 -> 86.1 km` (`H2O` mesopause floor) for discontinuous cliffs.
   - Evaluate `Body::Mercury` at `h = 1 R_M` (`2,439.7 km`) against Chamberlain (1963) spherical `1/(R+h)²` exospheric falloff `exp(-R_M/H_0 · h/(R_M + h))`.
   - Time `256` calls to `gasAbove()` (the `axisView.ts:64` globe-boot LUT loop) to verify cumulative column tables eliminate synchronous boot stalls (`<20 ms`).
2. **Audit `interior.rs` and `axisView.ts` radial profile continuity.**
   - Straddle the `500 km` exobase (`r = 6,870.9 -> 6,871.1 km`), the `L = 4.5` plasmapause (`4.49 -> 4.51 R_E`), the `3 km` PREM seabed (`6,368.00 -> 6,367.99 km`), and the `24.4 km` continental Moho in `axisView.ts:110–111`.
   - Check that neutral `gas.rs` density and plasmasphere density blend smoothly without a `1,000×` cliff or live panel self-contradiction between `radialProfile().rho` and `gasColumn().n`, that radial plasma pressure never jumps upward going outward across `L = 4.5`, and that continental Moho pressure increases monotonically with depth.
   - Verify `interior.rs` uses `constants::CO2_ppm_present` (not hardcoded `420.0`) and aligns `PREM_R` with `EARTH_RADIUS`.
3. **Audit `rt.rs` + `axisView.ts` ocean sun glint, grazing albedo, orbital eccentricity, and dynamic snow/ice.**
   - Trace the exact `axisView.ts:125` `phi` vector math into `rt.rs:21` for mirror specular reflection (`ps · pv = -1`) vs antisolar backscatter (`ps · pv = +1`): mirror geometry MUST peak Cox-Munk glint BRF and backscatter MUST approach zero.
   - Evaluate `ocean_albedo(mu)` at `mu = 0.05` and `mu = 0.001` against unpolarized Fresnel water reflectance (`n = 1.34 -> 1.0` at horizon).
   - Compare `rtPoint` TOA irradiance at Jan 3 perihelion vs Jul 4 aphelion against Spencer (1971) `((1+e)/(1-e))² = 1.06913`.
   - Check `axisView.ts:126` on winter snow-covered mid-latitudes (e.g., Jan 15 Kenora `49.77°N, -94.49°W` at solar noon `18.3 h UTC`) to verify live `PlanetSim` snow/ice/albedo planes drive `surf` instead of hardcoded `|lat| > 65/70`.
4. **Audit `species.rs`, `species-density.json`, and `landingCast.ts` biogeography & cycle continuity.**
   - Sample adjacent valleys `2.2 km` apart across a `*.5°` latitude/longitude boundary (e.g. `54.49°N` vs `54.51°N`) to catch white-noise `place_hash(lat.round(), lon.round())` phase jumps.
   - Test IUCN range boundary sites: Alaska (`60°N, -150°W`), Cuba (`20°N, -76°W`), Central Amazon (`-10°S, -65°W`), Kansas prairie (`39°N, -98°W`), Finland (`62°N, 25°E`), and Hudson Bay Lowland `Cover::Wetland` (`57°N, -88°W`, `elev = 80 m`, `veg = 0.60`).
   - Verify `landingCast.ts` passes the live world-clock calendar year (not frozen `LANDING_YEAR = 2026`) and includes year in its re-anchor cache key.
5. **Capture calibrated Rule 11 evidence + live WebGL frames.**
   - Run `npx tsx refs/planet/gas-interior-rt-species-audit/audit.ts <previewUrl>` on an `agy` preview port (`5250–5269`), verifying `calibrationValid = true` (`knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`), `0` console/page errors, `MediaRecorder` `recording.webm`, and visual inspection of every captured PNG.

## Tools and files used
- Harness: `refs/planet/gas-interior-rt-species-audit/audit.ts` (Playwright + headless Chrome SwiftShader + `MediaRecorder` WebM + WASM `PlanetSim`).
- Audited files: `rust/boreal-sim/src/gas.rs`, `rust/boreal-sim/src/interior.rs`, `rust/boreal-sim/src/rt.rs`, `rust/boreal-sim/src/lib.rs`, `rust/boreal-sim/src/species.rs`, `data/earth/species-density.json`, `src/world/globe/axisView.ts`, `src/core/landingRoster.ts`, `src/render/landingCast.ts`.

## Mistakes to avoid
- Assuming `r = 6,870.9 km` is below the `500 km` exobase at `49.77°N`: because Earth is oblate (`figureRadius(49.77°N) ≈ 6,365.7 km`), `r = 6,870.9 km` is already `505 km` altitude (`magnetosphere`). Use `r = 6,860 km` (`~494 km` thermosphere) vs `r = 6,871.1 km` (`~505 km` magnetosphere) when straddling the exobase at mid-latitudes.
- Passing `?hour=12` for Kenora solar noon on `?view=globe`: because `planet.home` sits at `+65.5°E` on current `main`, `hour=12` sets `7.6 h UTC` (Kenora night); pass `hour=22.7` for `18.3 h UTC` (Kenora solar noon, `μ☉ = +0.191`).
- Using Playwright `recordVideo` without `ms-playwright/ffmpeg`: use in-page `canvas.captureStream(15)` + `MediaRecorder` (`video/webm`) instead.
- Leaving the start menu open on ground-scene screenshots: dismiss the `Continue` button and wait for `#loading` to hide before capturing.

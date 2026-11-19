# Skill: planetary cloud microphysics, TS hydro/budget bypass, and Venus/mosaic audit

When to use: auditing or fixing the live globe `uHydroLayer` / `uLayerTex` surface-budget boundary (`planetLayers.ts`, `hydroLayer.ts`, `hydrosphereBudget.ts`, `surfaceBudget.ts`), TS planetary energy/atmosphere budgets (`solarBudget.ts`, `atmosphereBudget.ts`), Rust cloud diagnostics (`rust/boreal-sim/src/planet_fundamentals/atmosphere/cloud_fraction.rs`), ground-sky planet visibility (`venusSky.ts`), or overhead stand albedo tables (`landMosaic.ts`).

## Steps
1. **Verify who actually paints snow, sea ice, and soil wetness on the live globe.**
   - Check `src/world/globe/planetLayers.ts` (`LAYERS_FRAG`) and `src/world/globe/globeView.ts` (`refreshHydroLayer`).
   - Confirm whether `uHydroLayer > 0.5` bypasses the Rust spin-up texture (`uLayerTex`) and whether it honors `uLayers.x/y/z` (the Layer Panel `snowIceOn` toggle, `setCineLayerGate`, and `visibleWeight` camera-range gates).
   - Capture live regional WebGL frames BELOW `ORBIT_FADE.offM` (`700 km`, e.g. `alt=650000`) at **local solar noon** (`hour = 12 + (homeLonDeg - targetLonDeg) / 15` because `?hour=` is home local solar time at Kenora `94.48 W`, NOT UTC!) comparing default `uHydroLayer = 1`, `?hide=snowice`, and `?hydro=0` (Rust `uLayerTex`).
2. **Audit `hydrosphereBudget.ts` and `surfaceBudget.ts` against climatology.**
   - Check `cellAir` for Kenora continental temperature bias (`ANNUAL_T - seaLevelAnnualC(SITE.lat)`) and check whether `hydrosphereFrom` applies continental air temperature swings (`tMonth`) directly to open-ocean `sstC` and `ice`.
   - Measure the southernmost winter Northern Hemisphere sea-ice latitude (and northernmost Southern Hemisphere winter sea-ice latitude) in `bakeHydro(1400, 15, 12)` and `bakeHydro(1400, 196, 12)` against NSIDC sea-ice extent and NOAA WOA23 SST.
   - Check annual precipitation across contrasting climate regimes (Sahara 23.5 N, Amazon 3 S, Antarctica 80 S) against GPCP v2.3, and verify sub-sea-level inland land depressions (`kind: 'land', h: -430`) are never tagged `sea = 1`.
3. **Audit `solarBudget.ts` and `atmosphereBudget.ts` for single-site / diurnal leaks.**
   - Query `budgetFromAlbedo` from South Pole (−85°) to Equator (0°) on a fixed day/hour and verify `outgoing` OLR tracks local temperature/humidity/cloud (CERES EBAF ~135–290 W/m²) rather than a single site's surface $\sigma T^4$.
   - Sweep `atmosphereFrom` across 24 hours at multiple latitudes (10°–65°N) to detect any mismatch between diurnal `tC` (in `sea.q` and `tMean`) and non-diurnal `tMonth` (in `tRef`), which creates spurious 0→100% diurnal cloud oscillations and fake longitudinal thermal-tide geostrophic meridional winds.
4. **Audit Rust `cloud_fraction.rs` live through `public/wasm/boreal_sim.wasm` (`PlanetSim`).**
   - Test a dry desert plateau (`RH = 25%`, `elev = 2,500 m`, `u = 12 m/s`) to check whether synoptic warm advection (`-V·∇T`) differentiates raw terrain-lapsed `TAIR` instead of potential/sea-level temperature and fabricates up to 3,000 m of dry ascent.
   - Verify saturated lifted boundary-layer overlap (`c_rh = 0.50`, `rh * lift >= 1.0`): random-overlapping `cfront = c_lifted - c_rh` with `c_rh` leaves a −25 pp deficit (`0.75` instead of `1.00`).
   - Compare `t700_moist` against exact Bolton (1980) $\theta_e = T (P_0/p)^{R_d/c_p} \exp(L_v q / (c_p T))$ and measure the resulting `LTS` and Klein & Hartmann (1993) marine stratocumulus bias.
5. **Audit `venusSky.ts` and `landMosaic.ts` against atmospheric optics and BOA reflectance.**
   - Check whether `venusSky.ts` attenuates Venus by cloud optical depth and fog, places the point beyond distant horizon terrain (not 500 m), avoids WebGL square `PointsMaterial`, and includes Equation of Time in `utOf` (±16.4 min peak).
   - Compare `OVERHEAD_STAND` linear albedos against Sentinel-2 L2A / MODIS visible boreal surface reflectance (broadleaf green ~0.06–0.09, conifer ~0.03–0.05).
6. **Calibrate every metric (Rule 11) and verify live frames visually.**
   - Every check must report `score`, `knownMatchScore >= 0.99`, and `knownMismatchScore <= 0.25`.
   - Always inspect captured PNGs directly to verify daylight illumination, camera altitude band, and absence of loading overlays before recording measurements.

## Tools and files used
- Harness: `refs/planet/cloud-hydro-budget-venus-audit/audit.ts` (Playwright + headless Chrome SwiftShader + `MediaRecorder` WebM + WASM `PlanetSim`).
- Audited files: `src/world/globe/planetLayers.ts`, `src/world/globe/hydroLayer.ts`, `src/core/planet/hydrosphereBudget.ts`, `src/core/planet/surfaceBudget.ts`, `src/core/planet/solarBudget.ts`, `src/core/planet/atmosphereBudget.ts`, `rust/boreal-sim/src/planet_fundamentals/atmosphere/cloud_fraction.rs`, `src/render/venusSky.ts`, `src/world/globe/landMosaic.ts`.

## Mistakes to avoid
- Passing `?hour=12` when photographing Europe, Africa, or the North Atlantic on `?view=globe`: `?hour=` is local solar time at Kenora (`−94.48°`), so `hour=12` puts the North Atlantic in January night. Always compute `hour = 12 + (-94.48 - targetLon) / 15`.
- Capturing `uHydroLayer` above `ORBIT_FADE.offM` (`700 km`): above `700–2,500 km`, `ORBIT_FRAG` overwrites the tile colour with the orbit cover map, hiding `uHydroLayer` vs `uLayerTex`. Use `alt=650000` (`uOrbit = 0`).
- Assuming a `5 s` timeout clears the ground `#loading` overlay: explicitly wait until `#loading` is hidden before taking ground-sky screenshots.
- Leaving a preview Vite server or headless Chromium running: always wrap preview startup in `try / finally` and use an `agy` port (`5250–5269`).

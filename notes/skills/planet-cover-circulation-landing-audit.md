# Skill: `planet-cover-circulation-landing-audit`

Reusable workflow for auditing Boreal's Rust planetary cover/continentality (`cover.rs`, `altitudeZones.ts`, `coverKind.ts`, `planet.ts`), atmospheric circulation & surface budgets (`boot_order.rs`, `pressure.rs`, `wind.rs`, `longwave.rs`, `evaporation.rs`, `orographic.rs`, `solar_budget.rs`), and remote landing coordinate/DEM/surface-data pipeline (`landingSite.ts`, `surfaceData.ts`).

## Steps
1. **Load compiled WASM `PlanetSim` directly in Node (`tsx`)**:
   - Instantiate `public/wasm/boreal_sim.wasm` via `WebAssembly.instantiate` and wrap with `new PlanetSim(instance.exports)`.
   - Seed a `48 × 96` global land/elevation grid from `planetFor(1400, undefined, '', true).sampleSurface`, then run `sim.boot(15, 12)` (Jan), `16 × 3 h` spin-up (`sim.step(10800)`), `sim.boot(196, 12)` (Jul), and a pure-ocean `sim.boot(80, 12)` zonal-belt check.
   - Measure: global `PSL` min/max (compare to climatological `975–1,045 hPa` & WMO record `1,084.8 hPa`), share of cells pinned at `MAX_WIND = 40 m/s`, zonal ocean `max |v|` (Ekman cross-isobar inflow), post-boot `ROUGH` across land cells, overcast (`cloud > 0.95`) positive `LWNET` fraction, `>95%` sea-ice evaporation (`mm/day`), unsaturated desert ridge orographic `PRECIP`, `solarCell` perihelion/aphelion `SWdown/TOA` ratio, and `obliquity_deg = 90°` solstice declination.
2. **Audit global cover & coastal continentality across benchmark real cities**:
   - Evaluate `seaLevelZoneSeasonAtC`, `treeLineAtM`, `iceLineAtM`, `vegetationWeight`, `surfaceColour`, `coverKind`, and `zoneAt` at subpolar maritime coasts (`Bergen`, `Helsinki`, `Anchorage`, `Reykjavik`, `Edinburgh`, `Juneau`), temperate/subtropical forest sites (`New York`, `Paris`, `Tokyo`, `Miami`), hyper-arid deserts (`Sahara`, `Arabia`), and mid-latitude alpine meadows (`Alps 2,400 m`).
   - Compare every temperature, tree/ice line, and biome class against WMO 1981–2010 normals and Körner (2003) / Olson et al. (2001).
3. **Audit remote landing handedness, Terrarium DEM datum, & `surfaceDataAt`**:
   - Step `+10 km` along `tangentFrame(dir).east` and verify `Δlon > 0` (`+0.12718°` at `45°N`, not negative/West).
   - Inject uniform Mapzen Terrarium DEM tiles via `storeTerrarium` on both land (`Alps 2,400 m`) and ocean-seeded island (`Hawaii 1,200 m`) coordinates, call `engageLanding(dir, 0)`, and check `remoteGameHeight(0, 0)` vs `LEVEL.shore + 2` and `SITE.datumM` vs DEM elevation. Always call `clearLanding()` and `clearCachedTiles()` afterward.
4. **Capture live WebGL Chromium frames & video (`recording.webm`)**:
   - Start Vite on your agent's preview port range (`5250–5269` for `agy`) and visit `?view=globe&latlon=...&alt=...&day=...&hour=12&shot=1` across Bergen, Sahara, Alps, and full-Earth orbit.
   - Use in-page `canvas.captureStream(15)` + `MediaRecorder` (`video/webm;codecs=vp8`) so recordings work without external `ffmpeg`.
   - Measure PNG center RGB by decoding the saved PNG (do **not** `drawImage(webglCanvas)` outside `requestAnimationFrame` when `preserveDrawingBuffer` is false, or you will read `[0,0,0]`).
   - Always stop your preview Vite server and close headless Chromium before finishing.

## Verification & pitfalls to avoid
- Save `totalGlobalCells = sim.n` *before* calling `sim.init(9, 16)` for synthetic ridge tests so grid-fraction percentages use the global cell count (`4,608`), not `144`.
- Calibrate every Rule 11 check (`knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`) and write `numbers.json` unrounded.
- Check `npx tsc --noEmit`, `npx tsx tools/tasks.ts`, and `npx tsx --test tests/tasks.test.ts tests/sim-home.test.ts tests/gait-gate.test.ts` before pushing.
- Remember `AGENTS.md`: all new simulation fixes go in `rust/boreal-sim` (TypeScript simulation files in `tests/sim-home-ceiling.json` may only shrink).

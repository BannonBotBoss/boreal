# Skill: Orbit Cover, Prairie Overhead, Globe Quadtree/Handoff & Rust Hydrosphere/Orbit Audit (`orbit-prairie-handoff-hydro-audit`)

Reusable procedure for auditing Boreal's orbital cover baking (`orbitCover.ts`, `orbitDraw.ts`), prairie aerial overhead & steppe phenology (`prairiePhoto.ts`, `pbr.ts`), cube-sphere quadtree / landing handoff / far-layer (`cube.ts`, `handoff.ts`, `farLayer.ts`), and Rust hydrosphere/instability/COT/Milankovitch simulation (`instability.rs`, `cloud_optical_depth.rs`, `precipitation.rs`, `planet_eval.rs`, `orbit.ts`).

## Steps
1. **Start an isolated Vite dev server** on an `agy`-range port (`5250–5269`, never `5173–5209`) without touching the served repo.
2. **Run the calibrated Rule 11 + live Chromium harness**:
   ```bash
   npx tsx refs/planet/orbit-prairie-handoff-hydro-audit/audit.ts http://127.0.0.1:5265
   ```
   Verify `calibrationValid === true` (every check scores `>= 0.99` on known match and `<= 0.25` on known mismatch) and `consoleErrors.length === 0`.
3. **Check `orbitCover.ts` + `orbitDraw.ts`**:
   - Sample `coverPixel(cov, lat, lon)` across enclosed/marginal seas (Red Sea `20°N, 38°E`, Baltic `58°N, 20°E`, Persian Gulf `26°N, 52°E`, Caspian `42°N, 51°E`) and narrow islands (Honshu `36°N, 138°E`) to verify `a < 128` on water and `a >= 245` on land without `~195 km` non-premultiplied RGBA coast blur.
   - Measure `coastDistanceKm` on a synthetic E–W Arctic coast (`73°N -> 69°N`) and equatorial diagonal (`(20, 20)`) against spherical geodesic truth (`<10%` error).
   - Verify build time (`<40 ms` on main thread), bilinear float Blue Marble sampling (no `uint8` `linearByte` dark-forest truncation), and seasonal winter snow coverage.
4. **Check `prairiePhoto.ts` + `pbr.ts` (`steppeCure`)**:
   - Evaluate `steppeCure` across the year (`Dec 31`, `Jan 1`, `Jan 15`, `Feb 15`, `May 1`, `Jul 15`, `Aug 15`) to confirm winter dormancy without a Jan-1 green cliff.
   - Verify shaders use mipmapped `texture2D()` rather than `textureLod(..., 0.0)`, `openLandHere` respects `!cover.water`, hillshading follows live solar geometry without `8×` static clipping/sign flips, and `prairieFarGlsl` blends with `nearDisc` while keeping real lakes masked as water.
5. **Check `cube.ts`, `handoff.ts`, and `farLayer.ts`**:
   - Run `selectLeaves` at every quality tier (`split = 1.25, 1.5, 1.8`) near a cube corner `(1, 1, 1) / sqrt(3)` and verify 2:1 balance (`maxNeighbourLevelDiff <= 1`).
   - Test `eyeClearOfTrees` with an obstacle beside the midpoint of `[eye, eye + ahead]` (e.g. `(1.1, -1.25)` for `yaw = 0`), confirm `viewBlocked` accounts for terrain slope via `heightAt`, and check `farLayerScale` continuity around `150 m`.
6. **Check Rust `boreal_sim.wasm` hydrosphere, instability, COT, `planet_eval.rs`, and `src/core/orbit.ts`**:
   - Re-create `Float64Array(ex.memory.buffer)` **after** `ex.grid_init(36, 72)` (memory growth detaches earlier views!).
   - Advance `24 × 3 h` (3 days) on Earth bathymetry (`coarseMetresLinear`) and check:
     - Tropical ocean (`|lat| < 15°`) `INSTAB > 0` fraction (`>35%`, moist conditional instability).
     - Scattered cumulus (`0.15 < C < 0.35`) `COT` (`10–25`) vs cold polar overcast (`|lat| > 70°, T < -10°C, C > 0.7`, `1.5–4.0`).
     - Sub-saturated (`78% < RH < 92%`) flat ocean raining fraction (`<5%`).
     - Global area-weighted column water conservation `(PW1 - PW0) - ∫(E - P) dt` (`<2%` of `PW0`, `P / E ~ 1.0`).
   - Verify `milankovitch(0).e` matches `ORBIT.e` (`0.0167086`), past `precessionDeg` stays in `[0, 360)`, and `seasonLengths()` sums to the tropical year (`365.24219 d`).
7. **Inspect live WebGL frames & WebM clip**:
   - Use `?view=globe&latlon=lat,lon` (NOT `?dir=lat,lon`, which opens the Axis cutaway!) to capture uncut orbital views over the Middle East/Eurasia (`latlon=32,48`), Kazakh steppe overhead (`latlon=49.77,65.54&alt=2000`), and Tropical Pacific (`latlon=5,-140`), and visually inspect every PNG against nature references before concluding.
8. **Stop preview server and kill any headless browser** before committing.

## Mistakes to avoid
- Do not pass `?dir=lat,lon` when capturing uncut orbital globe frames — `axisView.ts` treats 2-number `dir=` as an interior cutaway request; use `?latlon=lat,lon`.
- Always re-acquire `new Float64Array(ex.memory.buffer)` after `ex.grid_init(...)` so WASM memory growth does not leave a detached/zeroed typed array view.
- Keep all simulation repairs in `rust/boreal-sim` per `AGENTS.md` (`tests/sim-home.test.ts` fails if any allowlisted TS simulation file grows).

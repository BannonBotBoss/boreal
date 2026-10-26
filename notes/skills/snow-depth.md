# Skill: snow depth from the snow-water store

When to use: the player, the ground, or an animal needs snow depth in centimetres, or a check that new precipitation below 0 °C is snow and at and above 0 °C is rain. T-0087, roadmap step 7, issue #100. This skill does not score sun angle, habitat class, or drought.

## Steps
1. Read the store that already exists. TypeScript `grid.swe` and the Rust `SNOW` plane are snow-water equivalent in millimetres (kg/m²). Do not add a second accumulator, a depth plane, or a new snow file. Issue #100's `PreviousSnow + NewSnow − MeltRate` is that store: new water joins it, melt leaves it.
2. Derive centimetres with `snowDepthCm` in `src/core/weather.ts`. Sturm et al. 2010 eq. 1 is SWE = depth × density / density of water. Rearranged, metres = `sweMm / HYDRO.snowDensity`, and centimetres are that length × 100. `HYDRO.snowDensity` stays 250 kg/m³. The Rust side does not grow its own density constant; the forest read calls the same function.
3. Keep the phase split that is already in the code. `precipFallsAsSnow` is `tC < 0`. `settle_precip` in `rust/boreal-sim/src/planet_fundamentals/hydrosphere/precipitation.rs` is the same comparison, then `melt_rate`. Exactly 0 °C is rain. Do not change it to `<= 0`.
4. Melt stays the degree-day factor already in the code. `HYDRO.ddf` and Rust `DDF` are 3 mm water-equivalent per °C per day (Hock 2003). `melt_rate` is `DDF * max(t, 0) / 86400`. Do not retune it.
5. One read. While the wasm planet is bound, `weatherAt` is `forestAt` (`planetWeather.ts`, T-0082). The near Kessler column is only the fallback when wasm is absent. Do not step both in one frame. `PointWeather.depthCm` is `snowDepthCm(sweMm)` on both paths, including a point outside the near grid (swe 0, depth 0).
6. The ground snow layer is that depth in metres (`snowDepthCm / 100`) with bulk `HYDRO.snowDensity` (`ground.ts`). Terrain `aSnow` stays `min(1, thickness / 0.05)` (`render/math.ts`). The 0.05 m is the existing full-white visual scale, not a depth constant. Do not add another.
7. Grass hides that layer. In `render/grass/grass.ts`, `uSnowM` is the same depth in metres at the player. A blade no taller than the snow is not drawn, so the terrain snow shows. The buried share of a taller blade mixes toward `vec3(0.8)`, the snow albedo already in `render/pbr.ts` (Oke 1987). July with swe 0 leaves `uSnowM` at 0 and the grass unchanged.
8. The player reads it on the status line (`Snow N.N cm` from `weatherAt` at the player) and in the inspector (`snow depth cm`). No new HUD constant.
9. Rebuild `public/wasm/boreal_sim.wasm` when `precipitation.rs` changes (`npm run build:wasm`, target `wasm32-unknown-unknown`) and commit it. The TypeScript tests load that file.

## Checks that proved it
- `snowDepthCm(0) = 0`, `snowDepthCm(10) = 4`, `snowDepthCm(250) = 100`, `snowDepthCm(86) = 34.4`. 10 mm of water is 1 cm; at 0.250 g/cm³ that is 4 cm of snow. 86 mm is the Kenora January store from T-0085, 34.4 cm.
- Sturm et al. 2010: the central half of seasonal-snow bulk density is 0.244–0.375 g/cm³, so 250 kg/m³ sits in that band. Table 3's taiga class is 0.217 g/cm³. It was not adopted. The `[verify]` on `snowDensity` stays. The paper's single 0.312 g/cm³ figure was not adopted either.
- `HYDRO.ddf === 3` and Rust `DDF = 3.0`. `melt_rate(1) * 86400 = 3`. A +2 °C day with 1 mm of rain on 20 mm of snow leaves 14 mm of snow and 7 mm of liquid (`settle_precip`).
- `precipFallsAsSnow(-0.01)` is true. `precipFallsAsSnow(0)` and `precipFallsAsSnow(0.01)` are false. Kessler at a reconstructed surface below 0 °C adds to swe and sets snowfall. At 0 °C and above, swe does not rise and the soil bucket does. `update_moisture` does the same on a flat land cell.
- The forest read of a Rust snow plane of 30 mm is `depthCm` 12 at −8 °C (snow falling) and still 12 at 0 °C and +4 °C (not snowing). Depth follows the store, not the falling flag.
- A ground column with swe 25 mm has a snow layer 10 cm thick, the same number `weatherAt` returns.
- `npx tsc --noEmit` exit 0. `npm test` and `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib` are the suite checks. The Kenora frames are `tasks/evidence/T-0087/`. A look percentage against a photo is uncalibrated; the lock is the sample (`tC`, `sweMm`, `depthCm`, the status line) plus the ground-pixel means recorded next to the frames.

## Mistakes to avoid
- A second snow model, a depth constant, or a new file under a snow name. Depth is the store divided by the cited density.
- Changing the 0 °C split. Exactly 0 °C is rain. Naming the comparison is not a licence to rewrite it.
- Retuning 250 kg/m³ to the taiga table value, or retuning the degree-day factor, so a screenshot looks deeper.
- Treating issue #100's 42 cm example as a game number. The centimetres come from whatever the store holds.
- Stepping Kessler and the Rust moisture update in the same frame. The bound planet is the only source.
- Judging snow on the ground from terrain `aSnow` alone. The grass field covers it. Bury and tint from `snowDepthCm`, using the albedo the terrain shader already uses.
- Painting snow with a new white. `vec3(0.8)` is the existing snow albedo.
- Claiming the task before another agent's approve-plan. The author of T-0087 cannot approve it.
- Scoring the sky date or the sun from these frames. `?day=` is a diagnostic jump. Record `WEATHER.day` and the clock day. Do not assign a sun-angle percentage.

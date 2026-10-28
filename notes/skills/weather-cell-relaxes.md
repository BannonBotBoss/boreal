# Skill: the near weather cell relaxes toward the planet climate

When to use: the air around the player should be a moving weather cell, and the climate it rests at should be the Rust planet grid (T-0082), not the private Kenora formula. T-0103, roadmap step 4, issue #100. This skill does not score sun angle or replace Kessler, the Manabe bucket, or the degree-day melt.

## Steps
1. Read `initWeather`, `updateWeather`, `stepSlices`, and `kessler` in `src/core/weather.ts`. The column already advects (Stam), rains (Kessler), buckets (Manabe 1969), and melts (`HYDRO.ddf`, Hock 2003). Do not add a second column or a second snow file.
2. The driver is `cellClimate(day, hour, z, x, zWorld)`. While `reader.target` answers, that is the planet sample at the column: surface temperature from `tair`, then `AIR.lapse` (0.0065 K/m, ICAO/ISO 2533) up the layer. Pressure is the planet `pressure` plane, or `AIR.p0` when that plane is still 0, dropped hydrostatically with `AIR.Rd` and `gravity()`. Wind `u` is east. Wind `v` is south (`-` the planet's northward `v`). Humidity, cloud fraction, precip mm/h, snow-water, and soil come from the same sample.
3. `relaxToward` is the nudge already on the column. One hour, and a quarter of that for temperature and humidity. The comment is `[game calibration]`. Do not add another time.
4. `updateWeather` still follows the planet clock. A date jump (`follow` returns true) seeds the cell again. Between jumps the cell steps. The cell does not write the planet planes.
5. `nearCellLive()` is true only after every cell in that seed came from the planet. `weatherAt` and `windAt` inside that grid then read the cell. Outside it they still read the planet. `bindPlanetWeather` clears the flag so a new grid is not read as the old cell.
6. The ground temperature adds `AIR.lapse * layerZ(0)` back onto layer 0. At rest that is the planet surface. Layer 0 is 200 m up (`DY` 400). Cloud cover and rain rate on the read are at least the planet's; Kessler can raise them. Snow depth stays `snowDepthCm`. New precipitation below 0 °C is snow. At and above 0 °C it is rain.
7. `climateRaw` is the wasm-absent fallback only. It is called from `climate()`, not from the near-grid loops. `tests/weather-cell.test.ts` counts `climateRaw(` in the source and counts calls while a planet is bound.

## Checks that proved it
- `AIR.lapse` 0.0065, `KESSLER` 1e-3 / 1e-3 / 2.2, `HYDRO.bucketMm` 150, `HYDRO.ddf` 3, `HYDRO.snowDensity` 250, `CLOUD_LWP_SAT` 0.2. None of these moved. `CLOUD_LWP_SAT` is the 200 g/m² the column already used.
- `relaxToward(0, 10, 3600)` is 10. With the quarter rate it is 2.5. A 120 s thermo step from 30 K below the target moves about 0.25 K.
- A uniform planet of 41 °C, rh 0.55, east 3, north 4, precip 24 mm/day, snow 30 mm, cloud 0.4: the live cell's surface read is 41 °C, rh 0.55, rain 1 mm/h, cloud at least 0.4, depth 12 cm, and it is not snowing. Filling `tair` with −8 °C and seeding again: snowing, depth still 12 cm. `climateRawCallCount` does not move. The planet plane is not written.
- With no planet, `initWeather` plus `stepWeather` does call `climateRaw`. That fallback stays.
- `precipFallsAsSnow` is still `< 0`. `snowDepthCm(30)` is 12. `npx tsc --noEmit` and `npm test` are the suite checks.

## Mistakes to avoid
- Calling `climateRaw` from `fillFromClimate`, `stepSlices`, `kessler`, or `cellPoint`. The fallback belongs in `cellClimate` after the planet target returns null.
- Skipping the column while the planet is bound. That was T-0082's read. Step 4 keeps the column and changes only its target.
- Stepping the planet moisture update and Kessler as two sources of the same rain. The planet is the resting climate. Kessler is the cell. The read shows at least the climate rate.
- A new relaxation time. The 1 h nudge and its quarter factor are already labelled game calibration.
- Changing the 0 °C split or the degree-day factor so a screenshot looks snowier.
- Leaving `nearCellLive` set after `bindPlanetWeather`. The next test would read a stale cell.
- Treating `?day=` frames as a sun-angle measurement. Record the cell and the clock. Do not assign a look percentage without a metric.

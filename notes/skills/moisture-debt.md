# Skill: Moisture Debt (`moisture-debt`)

## When to use
Use when tracking cumulative precipitation deficit (drought debt) across weather steps on the near weather column (`src/core/weather.ts`) or the Rust planet grid (`src/core/planetWeather.ts`, `rust/boreal-sim/src/planet_fundamentals/hydrosphere/soil_moisture.rs`) without introducing a second hydrology or a second monthly precipitation table.

## Mathematical & Physical Basis
1. **Cumulative Precipitation Deficit ($D_t$, mm)**:
   $$D_t = \max\!\left(0,\; D_{t-1} + \bar{P}(t)\,\Delta t - P(t)\,\Delta t\right)$$
   - **Citations**:
     - Cumulative precipitation anomaly / deficit over dry spells: Gibbs & Maher (1967), *Rainfall Deciles as Drought Indicators*, Bureau of Meteorology Bulletin No. 48, Melbourne; McKee, Doesken & Kleist (1993), *The relationship of drought frequency and duration to time scales*, 8th Conf. on Applied Climatology, AMS, pp. 179–184.
     - Non-negative cumulative moisture deficit structure: Keetch & Byram (1968), *A Drought Index for Forest Fire Control*, USDA Forest Service Research Paper SE-38; Van Wagner (1987), *Development and Structure of the Canadian Forest Fire Weather Index System*, Canadian Forestry Service, Forestry Technical Report 35.
     - Design issues: #100 (`MoistureDebt = ExpectedRainfall - ActualRainfall`) and #101 (`MoistureTracker::update`).
2. **Expected Rainfall ($\bar{P}(t)$, mm/day)**:
   - Reuses `NORMALS.precip` (`[27, 20, 29, 34, 76, 108, 101, 76, 89, 60, 42, 27]` mm/month, annual sum `689 mm`, Environment and Climate Change Canada 1981–2010 station Kenora A, climate ID 6034075) via `monthValue(NORMALS.precip, day) / MONTH_DAYS` (`expectedPrecipMmDay(day)`).
   - Never add a second monthly precipitation table.
3. **Normalized Drought Debt Index (`debt`, 0..1)**:
   - `moistureDebtIndex(debtMm) = clamp01(debtMm / HYDRO.bucketMm)` where `HYDRO.bucketMm = 150 mm` is the Manabe (1969, *Mon. Weather Rev.* 97:739) root-zone field capacity already in `src/core/weather.ts`.

## Implementation Contract
- **TypeScript (`src/core/weather.ts`)**:
  - `expectedPrecipMmDay(day)`: expected rainfall rate (mm/day) from `NORMALS.precip`.
  - `stepMoistureDebt(debtMm, expectedRainMm, actualRainMm)`: pure non-negative accumulator step.
  - `moistureDebtIndex(debtMm)`: normalized `0..1` drought debt against `HYDRO.bucketMm` (150 mm).
  - `MoistureTracker`: stateful wrapper matching issue #101 (`update(expectedRainMm, actualRainMm)`).
  - `grid.debt`: per-column `Float32Array(NX * NX)` updated in `kessler(dt)` and `catchUpWeather(dtSec)`, persisted in `saveWeather` / `loadWeather`, and shifted in `recentre`.
  - `weatherAt(x, z)` and `moistureDebtAt(x, z)`: expose `debtMm` and `debt` for the cell the player stands in.
- **Planet Grid (`src/core/planetWeather.ts` & `rust/boreal-sim/src/planet_fundamentals/hydrosphere/soil_moisture.rs`)**:
  - `accumulatePlanetMoistureDebt(sim, dtS, day)` steps per-cell debt from `sim.plane('precip')` during `spin` and exposes `debtMm` and `debt` on `weatherAtLatLon` and `forestAt`.
  - Rust `soil_moisture.rs` provides `step_moisture_debt` and `MoistureTracker` for crate-side callers.

## Verification Checklist
- Run `npx tsx --test tests/moisture-debt.test.ts` and `npx tsc --noEmit`.
- Verify that a dry stretch (`actualRainMm < expectedRainMm`) increases `debtMm`, a wet stretch (`actualRainMm > expectedRainMm`) decreases `debtMm`, and a deluge clamps `debtMm` at `0` (never negative).
- Verify that `weatherAt(x, z)` and `moistureDebtAt(x, z)` return finite `debtMm >= 0` and `debt` in `[0, 1]` for the cell the player stands in.

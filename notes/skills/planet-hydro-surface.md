# Skill: planet hydrosphere and surface budgets (one cell)

When to use: evaporation, precipitation, soil moisture, sea-surface temperature, ice, the humidity column, and the land/sea surface (heat capacity, roughness, snow, vegetation) on the globe, seeded, with no spin-up. T-0058.

## Steps
1. Call `hydrosphereBudget(seed, day, hour, direction)` in `src/core/planet/hydrosphereBudget.ts` and `surfaceBudget` in `src/core/planet/surfaceBudget.ts`. Neither stores a grid. `budgetsAt` samples the planet once and returns both.
2. Temperature is `cellAir`. The monthly shape is Kenora's one `NORMALS` table (`monthValue`, the same weights as `climate`). The annual mean is shifted with `seaLevelAnnualC` (North 1975, already in `altitudeZones`). South of the equator the seasonal anomaly flips. At `SITE.lat`, sea level, and Kenora's longitude, `cellAir(...).tC` matches `climate()`. Do not add a second monthly table. Do not call raw `climate().tC` at the equator: that column is Kenora.
3. The bucket is `bucketStep` in `weather.ts` (Manabe 1969, field capacity `HYDRO.bucketMm` 150). `stepSlices` uses that same function for overflow. A frozen month holds `HYDRO_SEED_FILL` (the grid's own 0.6 fill) instead of draining. Liquid equilibrium: rain above noon potential ET overflows; otherwise soil = 150 × rain / ET. Noon shortwave is used so the seed does not follow the clock across midnight. Evaporation is still `surfaceBalance` at the hour asked for (Penman–Monteith). Precipitation is the Kenora monthly total divided by `MONTH_DAYS` (30.44), six months out of phase in the south.
4. Ice is 1 over water when the warm-season mean is at or below 0 °C (`seaLevelWarmC`, the existing ice line) or the monthly temperature is at or below the seawater freezing point (`SEA_FREEZE_C`, UNESCO EOS-80 at 35 psu). Snow on land is 1 when the month is at or below 0 °C or the cell is above `iceLineM`. Melt rate is `HYDRO.ddf` × max(T, 0) (Hock 2003).
5. Roughness is `SURFACE[kind].z0`. Water is 0.0002 m, forest is 1.5 m. Kind is water, else snow, else forest when `vegetationWeight` ≥ `CANOPY` (0.35, game calibration), else moss. Vegetation is `vegetationWeight` in `planet.ts`: the spruce/mixed/temperate share `surfaceColour` already paints. Heat capacity is `HEAT_JM2K`.
6. The globe draws one texture (`hydroLayer.ts`, 48 × 96, RGBA snow / ice / soil / vegetation). `hydroLayerOn` follows the cloud-octave row: off when `CLOUDS.octaves` is 0 (Minimum). `?hydro=0` leaves the uniform at 0. `?day=` pins the seed date. While this layer is on, the rust spin-up snow/ice/soil paint is skipped so the two do not stack. The rust texture's alpha still feeds the cloud shell. No new mesh and no new quality ladder.
7. Gate: `tests/hydro-surface.test.ts`. The 150 mm bucket plus 10 mm returns soil 150 and runoff 10. Water and forest roughness stay the `SURFACE` pair. `icePlacement` scores 1 on a winter pole of ice with clear tropics and 0 on the swap. The January bake has to score at least 0.95.

## Checks that proved it
- Kenora day 172 hour 15: `cellAir` and `climate` printed the same 20.614973504365576 °C.
- Equator monthly temperature 27.2 °C. January 80 °N −37.7 °C. January 40 °S 25.6 °C (southern summer) and July 40 °S −3.9 °C.
- January bake, 24 × 48: winter-pole cover 1.000, tropics 0.014, score 0.986. Calibration paint scored 1 and 0.
- `npx tsc --noEmit` exit 0. `npm test` 761 tests, 747 pass, 0 fail, 14 todo.
- Frames: central 18% luma, January pole with the layer 85.92, equator 9.05, pole with `?hydro=0` 13.40. Score clamp((85.92 − 9.05) / 70, 0, 1) = 1. The hydro-off pair scores 0.06.

## Mistakes to avoid
- A second precipitation table, or a Budyko zonal model beside this column. T-0057 already declined that.
- Reimplementing `solar()`, `shortwave()`, or `surfaceBalance()`.
- Painting this texture and the rust spin-up snow on the same pixel.
- Treating `climate()` as if it knew the cell's latitude.
- Using the clock hour for the soil seed (night ET empties a bucket the noon sun would not).
- Importing `solarLayerOn` from `tile.ts` into `hydroLayer.ts`. `tile.ts` imports the hydro uniform, so the octave test is copied and `tests/hydro-surface.test.ts` asserts the two switches match.

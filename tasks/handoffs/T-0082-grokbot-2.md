# T-0082 handoff (grokbot-2)

Forest weather reads the Rust planet grid. One function, `weatherAtLatLon(latDeg, lonDeg, source?)` in `src/core/planetWeather.ts`, answers any point. The player is that function at `planet.fromLocal(x, z)`.

## What the forest was doing

`climateRaw` (`src/core/weather.ts`) is Kenora 1981–2010 normals, a diurnal cosine, and seeded synoptic noise. `weatherAt` used the near Stam/Kessler column when it was on and the point was inside it, and `climateRaw` otherwise. That column is still there for a frame where wasm did not load, and for the weather toggle off. It does not step on a frame the planet is driving.

The Rust grid is the Budyko/Sellers `climate_seed`, not those normals. January at the player's cell is about −6.4 °C against the ECCC January mean −16.0 °C. July is about 14.4 °C against 19.2 °C. The table records that. It does not force a match. Issue #101's 35 °C and ±15 °C sketches are not used. Snow is still air below 0 °C.

## How to boot

`openForestPlanet` takes `sharedPlanetSim()` (one wasm instance; a second `loadPlanetSim()` would be a second grid). It writes land with `planetLandSample`, the same mask as `globeLandSample`, boots two days early, and takes the globe's 8 × 6 h spin. `boot` leaves precipitation at 0. The first frame waits for this so terrain snow sees the snow plane.

The globe's `bootP` and `startPlanetLayers` use the same instance and mark the clock owner `globe`, so the forest does not reboot a grid the globe is drawing. While the forest owns it, a new date or a half-hour of clock drift re-spins once. An hour scrub inside that window does not.

`?day=` shifts `DAY.offset` by whole days after `?hour=`. Same clock.

## API

Degrees in, null when that grid is absent or empty. Cell centres return that cell. Elsewhere bilinear, longitude wrapped.

`tC` °C, `rh` 0..1, `q` kg/kg, `u` m/s east, `v` m/s north, `precipMmDay`, `precipMmH` (that divided by 24), `snow` (below 0 °C and precip > 0), `sweMm` mm water equivalent, `snowFrac` 0..1, `cloud` 0..1, `pressurePa`, `soilMm`, `ice` 0..1.

Player wind at 10 m is `{ x: u, y: 0, z: -v }` (game +z is south). Below 10 m the log profile scales it. `fog` is 0. There is no fog plane.

`planetLayers.bakeLayers` and the globe's local-cloud column both call this. `columnAt` stays for the nearest-cell test. `axisView.ts` `liveCell` still reads `q`, `cloud`, and `cot` off the planes (`cot` is not on this record). `climate()` is still what forage regrowth and the TypeScript cell budgets call.

## Checks

`npm test`: 813 tests, 799 pass, 0 fail, 14 todo. `npx tsc --noEmit` exit 0. Solar: existing `solarCell` vs `solar()` / `shortwave()` within 1e-9, and the `toa` plane after boot within 1e-6.

Evidence `tasks/evidence/T-0082/`: `?day=15&hour=12` and `?day=196&hour=12`, wasm file moved aside, then put back. Frames and `observations.json`.

Skill `notes/skills/rust-climate-authority.md`. Pull request https://github.com/BannonBotBoss/boreal/pull/129. Not merged.

## Left open

T-0085 sea and rain shadow, T-0086 moisture debt, T-0087 snow depth. T-0089's environment record should call this query, not the planes. Returning from the in-page globe does not hand the clock back to the forest. `axisView` `liveCell` and `fields.ts` `climate()` are not on this query.

# Skill: Rust climate authority

One weather query for any point on the planet. The forest player is that query at the gnomonic point under their feet. The globe's layer bake and its local-cloud column use the same query.

## Read

`weatherAtLatLon(latDeg, lonDeg, source?)` in `src/core/planetWeather.ts`.

- Inputs: latitude and longitude in degrees. Longitude wraps to −180..180. Latitude clamps to −90..90. `source` defaults to the bound `PlanetSim`. Pass a sim to read a grid that is not the bound one (the globe does this).
- Null when that grid is missing or `n` is 0. That is the wasm-absent frame. `climateRaw` in `src/core/weather.ts` still answers `weatherAt` then. Do not run both on the same frame.
- Cell centres (the grid's own lat/lon planes) return that cell. Anywhere else is bilinear, longitude wrapped.
- Fields on `PlanetPointWeather`: `tC` °C (`tair`), `rh` 0..1, `q` kg/kg, `u` m/s east, `v` m/s north, `precipMmDay` and `precipMmH` (`precip` / 24), `snow` (air below 0 °C and precip > 0), `sweMm` mm water equivalent, `snowFrac` 0..1, `cloud` 0..1, `pressurePa`, `soilMm`, `ice` 0..1.
- The player path is `weatherAt(x, z)` → `planet.fromLocal` → `toLatLon` → `weatherAtLatLon`. Wind at 10 m is `{ x: u, y: 0, z: -v }` because game +z is south. Below 10 m the existing log profile scales that wind. `fog` is 0. There is no fog plane.

## Boot

`openForestPlanet(day, localHour)` loads the one shared wasm instance (`sharedPlanetSim`), writes land with `planetLandSample` (the same mask as `globeLandSample`), boots two days early, and takes the globe's 8 × 6 h spin (`FOREST_SPIN`, equal to `planetLayers.ts` `SPINUP`). `boot` leaves precipitation at 0. The spin is why rain and cloud exist. The first forest frame waits for this so terrain snow sees the snow plane.

`sharedPlanetSim` is the only instance. A second `loadPlanetSim()` would be a second grid. The globe's `bootP` and `startPlanetLayers` take the shared one and set the clock owner to `globe`, so the forest does not reboot over a grid the globe is drawing.

While the forest owns the clock, `updateWeather` stores the game day and hour and re-spins only when the date moves by at least three quarters of a day or the UTC hour moves by at least half an hour. An hour scrub inside that window does not spin every frame.

## Fallback

`loadPlanetSim` returns null when the wasm is missing or the layout is stale. `registerPlanetRead` then reports not driving. `weatherAt` and `windAt` keep the near Stam column, or `climateRaw` outside it. `solarLayerFallback` stays the solar layer for that same absence. Kenora `NORMALS` stay the published comparison. They are not the driver.

## Do not

- Do not add a second clock. `?day=` shifts `DAY.offset` by whole days after `?hour=`. The game clock is still `dayAt` / `hourAt`.
- Do not use issue #101's 35 °C latitude span or ±15 °C season term. Snow below 0 °C stays (`precipitation.rs`, and the `snow` flag here).
- Do not edit `NORMALS` or `climateRaw` to force a match. The January and July table records the plane against ECCC 1981–2010. It will not match.
- Do not import `planetLayers` from `planetWeather`. The globe imports the query. The other direction is a cycle.
- Do not call `openForestPlanet` or `sharedPlanetSim` from a unit test that also uses another file's module-level `PlanetSim`. Bind a fresh `loadPlanetSim(bytes)` and `bindPlanetWeather(null)` in `finally`.
- `columnAt` in `localClouds.ts` stays for the nearest-cell test. Live clouds use `weatherAtLatLon`. `axisView.ts` still reads planes on its own.

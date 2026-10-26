# Skill: the forest reads the Rust climate

When the air, dampness, wind, rain, and snow at the player should come from the planet grid (T-0082). One source for a frame.

## Steps
1. Boot one `PlanetSim` with `bootGlobe` (`boot_order.rs`), not `seed`. Land and height come from `planet.ts` `sampleSurface`. Do not generate a second mask.
2. The forest is a few kilometres of land. A cell coarser than half a degree misses that land and reads the ocean (wind at the 40 m/s cap, January above freezing). Use `FOREST_NLAT` 360 and `FOREST_NLON` 720, and the nearest cell, not a blend with its neighbours.
3. The player stands on `planet.home`. Latitude is that home. Longitude is `toLatLon(planet.home)`, the seeded home, not `SITE.lon` (Kenora's −94.36). The home longitude for seed 1400 is near 65.5°E.
4. `climateAuthority.ts` must not value-import `planetBudget.ts` at the top. `weather.ts` imports the authority, and `planetBudget.ts` imports `SURFACE` from `weather.ts`. A value import while `weather.ts` is still starting throws `Cannot access 'SURFACE' before initialization`. Import the type only, and `await import('./planetBudget')` inside `startForestClimate`. Leave `homeLon` as NaN until a bind so this file's load does not touch `SITE`.
5. While the grid is bound, `climate`, `weatherAt`, and `windAt` read the planes. `climateRaw` runs only when the wasm will not load. Do not blend them. Drop the memo when the generation changes (bind, reset, a plane edit, a re-boot).
6. Rust `v` is the northward wind. World +z is south, so the forest's `v` is the negation. The plane is already the 10 m wind (the Rust friction factor). Use the log profile only below 10 m. Keep the slope tilt on the vertical part.
7. Snow when the air is below 0 °C and precipitation is falling. At 0 °C it is rain. Do not change that split (`precipitation.rs`). Do not replace the published budgets with the 35 °C or ±15 °C sketches.
8. Re-boot when the date moves by half a day or more, not every hour. The hour does not move these planes, and a half-degree boot is about a second.
9. Call `startForestClimate` before `startup`, then `initWeather` if the wasm bound, so the first shown frame is not a blend of the two. The loading screen covers that boot.
10. Do not paint the cloud plane on this boot. `update_clouds` with dt = 0 is an instant diagnosis. The globe spins 8 × 6 h (`SPINUP` in `planetLayers.ts`) before it trusts cloud. That spin does not fit a half-degree grid on the loading screen. `weatherAt.cloud` stays 0, the empty condensate the near grid already starts with. The plane stays on the sim for a later step.

## Checks
- `tests/planet-budget.test.ts`: a bound read matches the planes (north wind flipped); unbinding restores `climateRaw`; 0 °C with rain is not snow; a cloud plane of 1 does not reach `weatherAt.cloud`; the home cell is warmer in July than in January. The solar test treats loaded wasm as the source and checks `weather.ts` to 1e-9.
- `npx tsc --noEmit`. `npm test`. `cargo test` only if Rust changed.
- Numbers, said yes or no, not overwritten to force a yes: home-cell January and July against `NORMALS` (Kenora A 1981–2010). January air near −20.6 °C against −16.0 °C is no. July near 26.9 °C against 19.2 °C is no. Rain at the boot is 0 because moisture is not stepped. Solar parity is yes.
- Frame, default morning `?view=ground&nomenu&noprobe&hour=8`, wasm file present against the same file moved aside. Sky band y 30–200, 8³ sRGB histogram intersection. The shipped pair scored 0.989. Feeding the unspun cloud scored 0.36 against the same before frame (sky luminance 189 against 200). That is the calibration: same morning near 1, a solid deck near 0.36.

## Mistakes
- A 36×72 or 90×180 nearest cell is ocean. Bilinear on a coarse grid mixes the island with the sea and is the wrong place.
- Completing the task while January or July misses the Kenora table.
- Painting cloud ≈ 1 from the first boot. The August morning then goes grey with no rain.
- Sampling `SITE.lon` for the forest.
- Approving a plan you authored. T-0082's author is grokbot-3.

# Skill: geology-first landform and latitude-band habitat audit (`habitat-from-geology`)

Use when mapping landform generation (mountains, valleys, floodplains, plateaus, basins, wetlands, coasts) or auditing/refactoring biome, flora, water, ice, and fauna placement so habitats emerge from elevation, slope, drainage, soil, and climate rather than hardcoded latitude bands (Issue `#98`).

## Steps

1. **Pin the base commit (`git rev-parse HEAD`)** and record exact `file:line` references against it across all three spatial scales in Boreal:
   - **Local staged region (`src/core/stages/`)**: `elevation.ts` (ridged multifractal + fBm basins + hydraulic droplet erosion + Priority-Flood `lakeGrid`), `flow.ts` (D8 routing + upslope accumulation `acc`), `rivers.ts` (`extractRivers`, `labelRiverPonds`, `carve`, `breachUnconfined`), `soils.ts` (`buildSoils`, HAND, TWI, MSH `landscape` classes `'flat wetland' | 'sloped wetland' | 'hillslope' | 'plateau'`, `SoilKind`), and `surfaceAt.ts`.
   - **Local ecology consumers (`src/core/`)**: `altitudeZones.ts`, `flora/site.ts`, `treeSpecies.ts`, `stand.ts`, `habitat.ts`, `climateClass.ts`, and `planetWeather.ts`.
   - **Global planet & landing bridge (`src/world/globe/`, `rust/boreal-sim/src/`, `data/earth/`)**: `plates.ts`, `planet.ts`, `coarseRelief.ts`, `openTiles.ts`, `orbitAlbedo.ts`, `coverKind.ts`, `coverSample.ts`, `landingSite.ts`, `rust/boreal-sim/src/cover.rs`, `rust/boreal-sim/src/species.rs`, `rust/boreal-sim/src/grid.rs`, `rust/boreal-sim/src/planet_fundamentals/hydrosphere/orographic.rs`, `data/earth/altitude-zones.json`, `data/earth/cover-density.json`, and `data/earth/species-density.json`.
2. **Map each landform explicitly at both local and global scales**:
   - Separate **geometry/hydrology builders** (e.g. `carve()` channel incision, `h = 0` sea-level contour, `coastAt` distance) from **discrete landform/habitat classifications** (`CoverKind`, `Soil.landscape`).
   - Check whether intermediate causal links are wired or disconnected (for example, `plates.ts` computes convergent boundaries, while `planet.ts` `makeNoise().relief` does not read `plates.ts`; `soils.ts` computes `landscape = 'plateau'`, while `surfaceAt.ts` omits `.landscape`). Mark missing outputs explicitly as `"not built"`.
3. **Grep systematically for latitude tests across TS, GLSL, Rust, and JSON**:
   - Run `git grep -n -E "lat|Lat" -- src/ rust/boreal-sim/src/ data/earth/` and `git grep -n -E "smoothstep\([0-9]+|lat [<>=]|latDeg [<>=]" -- src/ rust/boreal-sim/src/`.
   - Classify every hit into one of two buckets:
     - **Bucket A (Direct latitude-band habitat/substrate shortcuts — offenders against `#98`)**: Hard thresholds or `smoothstep(lat0, lat1, |lat|)` ramps that directly pick a cover class (`wetland_lat_min`), damp canopy (`vegetationWeight` `60..66°`), gate lake existence (`38..72°`), force ice/pack-ice (`80..86°`, `66..80°`), tint ground photographs (`biomeGrade` `32..48..70°`), or clip animal presence (`species-density.json` `lat: [min, max]`) even when ground and climate already support or forbid the habitat.
     - **Bucket B (Physical solar geometry or zonal insolation/temperature boundary conditions)**: Solar declination/zenith (`solar_budget.rs`, `timeOfDay.ts`), Coriolis/grid metric (`cos(lat)` in `wind.rs`, `orographic.rs`), and North (1975) $P_2(\sin\phi)$ zonal temperature fits (`altitudeZones.ts`, `cover.rs`). Note where zonal temperature fits could later be replaced by the stepped `PlanetSim` `tair`/`precip`/`soil` planes.
4. **Test interaction bugs between new causal rules and legacy latitude ramps**:
   - Whenever a causal rule is added (such as `#192` / `T-0126` continental `treeLineAtM` lifting the subarctic tree line to `~600–815 m` inland), test `65–69°N` inland inputs end-to-end through `vegetationWeight` -> `coverKind` -> `landingPopulation`. Legacy `smoothstep(60, 66, |lat|)` ramps in upstream weights can silently zero out `vegetation` below the lifted tree line and turn boreal forest into `'desert'`.
5. **Pin findings in a fast unit test (`tests/habitat-from-geology.test.ts`)** so reviewers can verify every mapped builder and latitude boundary in `< 2 s` via `npx tsx --test`.

## Checks That Prove It Worked

- Every target landform in `#98` has an exact `file:line` builder entry (local and global) or `"not built"` with the missing mechanism stated.
- A reviewer can open any three rows at the pinned commit and confirm the exact threshold/function, and run `npx tsx --test tests/habitat-from-geology.test.ts` + `npx tsc --noEmit`.
- Pure audit tasks modify zero runtime simulation behaviour while recording clear downstream dispositions under Rule 12.

## Mistakes to Avoid

- Conflating local 7.68 km Shield stage outputs (`soils.ts` `peat` / `plateau`) with global planet cover (`coverKind.ts` / `cover.rs`): a landform built locally on the Kenora tile may still be `"not built"` or latitude-gated globally on the sphere.
- Mistaking `plates.ts` MORVEL boundary rendering for tectonic mountain building without checking whether `planet.ts` `sampleSurface` actually reads `plates.ts`.
- Treating solar declination or grid metric `cos(lat)` terms as biome latitude hacks, or conversely excusing `|lat| >= 50°` wetland cuts and `smoothstep(60, 66, lat)` canopy cuts as "climate".

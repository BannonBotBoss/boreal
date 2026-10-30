# Globe -> landscape seam baseline (sprint #192, Oct 29 2026)

Grokbot-1, landscape/globe seam lane. Script: `npx tsx tools/globe-seam-baseline.ts`. Test: `tests/globe-seam-baseline.test.ts`.

## What is measured (headless, Node, no renderer, no network)

For each of ten site kinds the script calls `engageLanding` (the same call the in-page drop makes), then compares:

- **Coordinates**: `SITE.latDeg/lonDeg` vs the clicked point.
- **Landing height**: local `heightAt(0,0)` vs the horizon skirt height (`skirtSample` + the same micro-relief term `horizonMesh.ts` adds) at the landing point.
- **Seam**: worst |local `heightAt` - skirt height| over 16 bearings on rings at 28 m (skirt inner edge), 100, 300 and 600 m.
- **Relief**: local height range vs the planet's own height range over those samples.
- **Load errors**: throws or non-finite heights.

**Not measured here:** FPS, memory, screenshots, cloud/camera continuity. They need a WebGL browser run; none was captured in this headless pass. DEM and photo tiles only load in the browser, so `sampleDem` is null here and the seeded planet is the only height source.

**Site choice:** globe heights come from the seeded planet (`planet.ts`), not from Earth, so most Earth coordinates are ocean or lake there. Each kind starts from an Earth coordinate and walks a 1 degree grid out to the nearest planet point that matches it, for example dry land above 1800 m for alpine. `movedDeg` is how far it had to go. Labels such as "desert" or "tropics" only describe latitude and height. They do not mean the planet has that biome there.

## Bug found and fixed: off-home landings were flat

`planet.sampleSurface` reuses one result object. `engageLanding` kept a reference (`origin`), so every later sample overwrote it, and the height reader computed `s.h - origin.h` = 0 everywhere. The local patch at any off-home landing was flat (only micro-relief). The horizon skirt and globe kept the real relief, which made a step at the seam. Fix: keep the number (`originH`) rather than the object.

| site kind | lat, lon | moved | datum m | seam @28/100/300/600 m BEFORE | AFTER | local/planet relief BEFORE | AFTER |
|---|---|---|---|---|---|---|---|
| boreal forest | 52, -97 | 3 | 78.5 | 1.19 / 6.42 / 13.21 / 18.65 | 0 / 0 / 0 / 0 | 0.04 / 34.47 | 34.47 / 34.47 |
| tundra | 64.5, -119.7 | 14 | 580.6 | 0.92 / 3.56 / 14.43 / 19.23 | 0 / 0 / 0 / 0 | 0.04 / 33.66 | 33.66 / 33.66 |
| alpine (>1800 m) | 0.5, 54 | 46 | 2163.6 | 1.37 / 3.56 / 11.26 / 15.37 | 0 / 0 / 0 / 0 | 0.04 / 18.90 | 18.90 / 18.90 |
| coast | 44.3, -122.2 | 5 | 68.2 | 1.55 / 4.30 / 13.60 / 11.02 | 0 / 0 / 0 / 0 | 0.04 / 17.19 | 17.19 / 17.19 |
| desert lat | 27.4, 27.7 | 4 | 585.4 | 2.75 / 6.47 / 12.34 / 25.60 | 0 / 0 / 0 / 0 | 0.04 / 41.49 | 41.47 / 41.49 |
| tropics | -7.1, -67 | 7 | 325.6 | 1.64 / 4.63 / 8.21 / 14.50 | 0 / 0 / 0 / 0 | 0.04 / 24.98 | 24.97 / 24.98 |
| ocean edge | 36.6, -121.9 | 0 | 0 | 0.02 / 0.02 / 0.02 / 0.01 | same | 0 / 0 | same |
| polar | 74.2, 50.6 | 35 | 108.1 | 0.99 / 3.50 / 12.17 / 18.56 | 0 / 0 / 0 / 0 | 0.04 / 27.42 | 27.41 / 27.42 |
| prairie | 51, -107 | 1 | 885.6 | 3.13 / 13.35 / 29.61 / 32.37 | 0 / 0 / 0 / 0 | 0.04 / 56.69 | 56.70 / 56.69 |
| wetland (lake) | 47.9, -104.9 | 24 | 128.8 | 1.97 / 2.87 / 12.52 / 18.69 | unchanged | 0 / 44.72 | unchanged |

In all ten, coordinate drift was 0.00 degrees and the landing-point height delta was 0.00 m. There were no load errors and no non-finite heights.

## Open seam (not fixed here)

- **Lake landings**: the local patch draws one flat water plane (`waterSurface - 0.35`). The far-field lake surface in `planet.ts` follows the pre-carve terrain (`out.level = h`), so the skirt's water slopes. The step reaches 18.7 m at 600 m. A fix means deciding on one lake level per water body, which is a model change, so it is left for Oct 30.
- **Seeded planet vs Earth**: an Earth click such as Kenora, the Alps or the Amazon lands on whatever the seeded planet has there, which is often ocean. In the browser, cached DEM tiles correct the height (`elevationWins`), but nothing ties land cover to real Earth yet. This goes with the Oct 31 "coordinate-driven terrain" item.

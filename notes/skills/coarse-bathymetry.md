# Skill: coarse bathymetry under a seeded mountain

Use when a landing's HUD elevation and biome disagree with the ocean at that latitude and longitude.

## Search before writing

1. `sampleSurface` lives in `src/world/globe/planet.ts`. `radial.ts` `surfaceRadius` does not sample. It is `figureRadius + max(h, water)`. A negative bathymetry with water at 0 is sea level. A positive `h` and `water` of `-Infinity` is a mountain.
2. The zoom-0 Mapzen terrarium tile is one 256×256 image, `(R*256 + G + B/256) - 32768` metres, the same decode as `openTiles.terrariumMetres`. Joerd's ocean is ETOPO1 (Amante and Eakins 2009). Sea level is 0.
3. `elevationWins` only lets a positive DEM replace a seeded ocean. A negative DEM does not replace a seeded mountain. `groundForCover` then keeps the seed height, and `coverKind` calls anything above the ice line ice.
4. Open ocean already has a water surface: `landingSite.ts` returns `LEVEL.waterSurface - 2` when `kind` is ocean. `landingShore.ts` does not move the player when no dry cell exists inside the census square. Do not snap an abyssal aim onto invented land.
5. The home square and its lift stay the game terrain. The mask applies only outside `PLANET.home.liftKm`.

## Steps

1. Read the zoom-0 pixel with the same Web Mercator as `openTiles.slippy`. Nearest pixel. 8.487 N, 129.334 W is pixel (36, 121), -4589 m.
2. Outside the home lift, if that pixel is below 0, set `h` to it, `water` to 0, `kind` to `ocean`. If the pixel is land and the seed said ocean, raise `h` to the pixel so the land share stays near 0.292.
3. On an ocean origin, `treeShare` is 0. A null cover used to keep share 1, which plants a closed stand on the sea.
4. Water vegetation is 0. A Sentinel-2 blue pixel's green-red index is not a canopy (`vegetationFromPhoto` starts at 0.55).

## Checks

- `tests/ocean-bathymetry.test.ts`. With the mask off, the same direction is still the 5074 m mountain. With it on, `surfaceRadius` is the figure, the HUD is water at 0 m, and the feet stay at the aim.
- `tests/globe.test.ts` land share stays within 4 points of 0.292, and the home square is still `heightAt`.
- A frame of the aim is not a clipped white sheet (snow albedo 0.8, pixels about 243–248). The reference is the EOX Sentinel-2 cloudless tile, open ocean, mean sRGB about 16, 28, 51.

## Mistakes to avoid

- Do not put a second continent generator inside the home lift. The lift test requires the region edge to stay land.
- Do not report the sea floor as the player's elevation. The surface they stand on is sea level, 0. The pixel depth stays on `h` for the mask.
- Do not edit the horizon mesh, the continuous terrain mesh, or the canopy to change this. Those reads already call `sampleSurface`.
- A zoom-0 pixel is about 156 km. It decides ocean versus land. A finer terrarium tile still wins when it says land above sea level (`elevationWins`).

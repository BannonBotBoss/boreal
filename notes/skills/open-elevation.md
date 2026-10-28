# Skill: real elevation from open terrain tiles

Use when a landing should take its hills from a measured DEM instead of only the procedural planet, anywhere on Earth, and still run offline.

## Search before writing

1. The skirt already samples `planet.sampleSurface` (`src/world/globe/horizonSkirt.ts`, `src/render/horizonMesh.ts`). Do not add a second height function for the chunks. `heightAt` stays the near ground.
2. The AWS Terrain Tiles are terrarium PNGs. Height is `(R * 256 + G + B / 256) − 32768` metres. The licence is the joerd attribution list (USGS public domain, Copernicus EU-DEM, Canada Open Government Licence, and the rest of that file). Cite it. Do not ship a private DEM.
3. The browser decodes the PNG. Tests store pixels with `storeTerrarium` and never fetch.

## Steps

1. Cache tiles by `z/x/y`. `warmDemTiles` fetches zoom 8 (the horizon) and zoom 11 (the valley) in a 3×3. A failed fetch stores null and is not retried.
2. `sampleDem` bilinear-samples the finest cached zoom. Null means the planet height stays.
3. `blendDem` keeps the planet height under the camera (so the chunk mesh does not become a step) and the DEM past about 1.6 km. Water stays the planet water surface.
4. The chunk dither disc is `0.7 ×` the loaded radius, so the square corners are discarded and the patch edge is a circle.

## Checks

- `tests/open-tiles.test.ts`: terrarium zero and 1000 m, a stored tile samples, a hole is null, water is not replaced.
- Denver at zoom 8 reads about 1606 m against the city datum near 1609 m. That check is a one-off fetch, not a unit test.
- `npx tsc --noEmit` and the skirt tests. Stills at the T-0108 landings.

## Mistakes to avoid

- Do not apply the DEM under the chunk disc. The two surfaces will not match and the square becomes a cliff.
- Do not treat a missing tile as height 0. That is a hole in the ocean. Null keeps the planet.
- Canvas `getImageData` is RGBA. The file on S3 is RGB. The browser path already expands it.
- The seeded home longitude is not geographic Kenora. The inner kilometre stays the staged stand. The DEM is the real Earth at the lat/lon the globe already uses.

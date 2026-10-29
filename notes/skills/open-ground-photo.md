# Skill: photographic ground colour on the horizon rings

Use when the skirt should take its colour from an open satellite mosaic, and still read at drone height.

## Search before writing

1. The colour hook is `samplePhoto` in `src/world/globe/openTiles.ts`. Elevation is already there. Do not add a second tile cache.
2. EOX Sentinel-2 cloudless 2021 is CC BY 4.0 (https://s2maps.eu). Cite it. The URL is `OPEN_TILES.photoUrl`.
3. Water Fresnel is the globe's own F0 of 0.02 (`src/world/globe/tile.ts`, n = 1.33). Do not invent a new water shader stack.
4. `blendPhoto` multiplies the photograph by a grain inside 50 m and eases that grain out by 700 m.

## Steps

1. `warmPhotoTiles` at zoom 8, 10 and 12. Zoom 8 is at least a 5×5 (`tileRing` ≥ 2) so a camera on a tile edge still covers the horizon. Zoom 12 reaches about 36 km. A missing neighbour pixel clamps. A missing fine tile falls through to the coarser zoom. It does not drop the sample.
2. Land uses `blendPhoto`. Water uses the photograph, then Schlick Fresnel toward the haze colour, F0 = 0.02, capped at 0.85 so the water does not become a mirror of the UI.
3. If no photograph is cached, the vertex colour is `globeMatch` (the globe palette lifted toward the mosaic, so a hole is not black). The skirt shader then replaces that fragment with the far-layer globe texel when the far depth shows the globe actually drew there. The far clear stays the lifted vertex colour.

## Checks

- `tests/open-tiles.test.ts` stores a green JPEG-like tile and checks the close grain is darker than the far pixel.
- Stills at the T-0108 landings. A green and blue mosaic means the photograph arrived. Black voids mean a tile edge was dropped. Flat dark colour means the fetch did not land.

## Mistakes to avoid

- Read `ImageBitmap` width and height before `close()`. After close they are 0, the tile is stored empty, and the sample is NaN, which draws as a black polygon.
- Decode a few tiles at a time. A burst of `createImageBitmap` fails together, and caching that failure as an empty tile keeps the hole.
- Do not fail a zoom because the bilinear neighbour tile is missing. That punches black holes.
- Do not treat a zoom-8 ring of one tile as enough. The horizon at drone height is about 70 km and a tile edge leaves the next tile black.
- Do not reject a globe-texture fallback because its luma is under 0.04. Boreal canopy in that buffer is darker than that, and the hole stays black.
- Do not multiply the finished colour by a large gain. Coarse triangles become neon facets.
- The seeded longitude is not geographic Kenora. The photograph is the real Earth at the lat/lon the globe uses.

# Skill: photographic ground colour on the horizon rings

Use when the skirt should take its colour from an open satellite mosaic, and still read at drone height.

## Search before writing

1. The colour hook is `samplePhoto` in `src/world/globe/openTiles.ts`. Elevation is already there. Do not add a second tile cache.
2. EOX Sentinel-2 cloudless 2021 is CC BY 4.0 (https://s2maps.eu). Cite it. The URL is `OPEN_TILES.photoUrl`.
3. Water Fresnel is the globe's own F0 of 0.02 (`src/world/globe/tile.ts`, n = 1.33). Do not invent a new water shader stack.
4. `blendPhoto` multiplies the photograph by a grain inside 50 m and eases that grain out by 700 m.

## Steps

1. `warmPhotoTiles` at zoom 8 and 12, 3×3. A missing neighbour pixel clamps. It does not drop the whole zoom.
2. Land uses `blendPhoto`. Water uses the photograph, then Schlick Fresnel toward the haze colour, F0 = 0.02, capped at 0.85 so the water does not become a mirror of the UI.
3. If no photograph is cached, `surfaceColour` stays.

## Checks

- `tests/open-tiles.test.ts` stores a green JPEG-like tile and checks the close grain is darker than the far pixel.
- Stills at the T-0108 landings. A green and blue mosaic means the photograph arrived. Black voids mean a tile edge was dropped. Flat dark colour means the fetch did not land.

## Mistakes to avoid

- Do not fail a zoom because the bilinear neighbour tile is missing. That punches black holes.
- Do not multiply the finished colour by a large gain. Coarse triangles become neon facets.
- The seeded longitude is not geographic Kenora. The photograph is the real Earth at the lat/lon the globe uses.

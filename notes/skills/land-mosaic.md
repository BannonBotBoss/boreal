# Skill: vegetated land from above is a stand mosaic

Use when a drone or a low overhead shows one flat colour, or flat neon tiles, where the biome is vegetated.

## Search before writing

1. `samplePhoto` in `src/world/globe/openTiles.ts` is the real Sentinel-2 mosaic when a tile is cached. Do not add a second tile cache.
2. The overhead at a few hundred metres is the globe tile shader (`src/world/globe/tile.ts`). The glide ground outside the chunks is the skirt (`src/render/horizonMesh.ts`).
3. `detN` in the tile shader is the lattice hash that stays exact at planet scale. Use it. A raw `sin` of a planet coordinate collapses.

## Steps

1. Waves are 40 m, 160 m and 640 m. Sentinel-2 MSI is 10 m (Drusch et al. 2012). Those three are the stand and wetland patches a true-colour mosaic shows.
2. Mix the vertex albedo toward a browner fen and a greener broadleaf. The CPU twin is `landMosaic`. The mean stays near the albedo.
3. Fade the mix when a 40 m cell is under about 2 px, so a full disk stays smooth.
4. Do not multiply the skirt by a large green gain. Coarse triangles become neon facets.

## Checks

- `tests/land-mosaic.test.ts`: the same place is stable, points a few hundred metres apart are not one green, the mean stays near the spruce albedo, and both shaders name the three waves.
- `?view=globe&alt=400&latlon=52,-97&localClouds=0` is mottled land, not one fill.

## Minimum tier, and the far layer

The stand mosaic used to sit inside `if (uDetail.x > 0.001)`. Minimum's detail is 0
(`src/world/globe/lod.ts`), and a slow frame drops the tier there. The drone then
paints one albedo. `standMosaicActive` ignores that strength. The 2 px fade still
hides the mosaic on a full disk. Below 20 km a coarse tile widens the wave until it
is a few pixels (`uLiveMosaic`). The mosaic is applied after the era mix, because
the plant colour is one green and it used to replace the mosaic.

The in-page far layer was 320×144 while it was the whole drone picture, and the
upscale hid the mosaic. `farLayerScale` stays 1 above 150 m. Half resolution returns
on the ground once the patch fade is in.

## Mistakes to avoid

- Do not call the lattice hash on an un-wrapped planet coordinate with `floor` passed straight into `ivec`. It crushed the frame to a dark red. Use `detN`, which already mods the cell.
- Do not leave the 1.4 green gain on the skirt.

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

## Crowns

A jittered 12 m grid of identical disks is a dot wallpaper at 400 m. Do not stamp that.
A smooth 160 m and 640 m blend is the other failure: at 2000 m (about 1–3 m per pixel
on a 45° lens and a 1280 px frame) it is an out-of-focus green, and a mean-luma match
to a zoom-8 tile (~376 m per pixel at 52°) will pass it.

Paint camera-relative metres (`vAerial = world − camera`, subtracted in the vertex
shader). Planet-frame `vDetW` is ~6e6 and the 40 m noise becomes speckle. Crowns are
ellipses on a cell of about seven pixels, clamped to 6–28 m, with a jitter near one
cell so the lattice disappears. The crown albedo and the gap albedo must differ in the
green channel or luma stays one histogram bin. Fens are the low part of a 180 m field
plus the ring around a pond. Ponds are a 150 m field the 1.8 km lake octave cannot
draw inside a 2 km frame; punch `landMask` before the aerial blue or the pond stays
the 0.01 albedo and reads black.

The skirt still has the 12 m step. Do not copy that step onto the tile.

## Overhead quads

A vertex colour is constant across a coarse quad. `overheadStand` is a function of world
metres only. Gate it on `length(vViewPosition)`, about 120 m to 20 km. `fwidth` of the
tile position does not track metres per pixel here, and a gate on it left the frame on
the vertex albedo.

Do not write MODIS reflectance (a few percent) into this material. The globe sun is
intensity 3.2, Lambert divides by π, and ACES exposure is 1. A few percent then
tone-maps to sRGB luma about 20. `OVERHEAD_STAND` is the albedo that lands near the
EOX Sentinel-2 cloudless tile of this region (52 N, 97 W, zoom 8, CC BY 4.0): mid land
about luma 39, red-dominant share 0. Fen stays olive (red does not lead green). August
boreal is not red.

`aLake` means `surf.level > 0.5`, which is most dry land. Do not paint `vLake` as water.
Open water is the height field below its level. Below 8 km that water used to be forced
to land (`uHideLake`). The aerial band leaves it as water.

## Checks that are not a luma spread

`tests/overhead-stand.test.ts` `aerialStructure` reads edge (mean 1 px luma step), blue-dark
water share, histogram peak, and chi-square distance to
`tasks/evidence/T-0189/ref-eox-z14.png` (EOX Sentinel-2 cloudless 2021, z14 y5484 x3868,
about 51 N, 95 W, 6.1 m per pixel, CC BY 4.0). The reference is the known match.
`tasks/evidence/T-0187/after-globe-2000.png` is the known mismatch: luma near the old
zoom-8 tile, edge about 0.08, no water, one histogram bin. A variance or mean-luma test
passes that frame.

## Mistakes to avoid

- Do not call the lattice hash on an un-wrapped planet coordinate with `floor` passed straight into `ivec`. It crushed the frame to a dark red. Use `detN`, which already mods the cell.
- Do not leave the 1.4 green gain on the skirt.
- Do not treat a higher luma standard deviation as a fix. Measure the colour against a sourced frame.
- A backtick inside the tile shader template closes the string. Esbuild then fails the module.

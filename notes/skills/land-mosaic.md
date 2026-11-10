# Skill: vegetated land from above is a stand mosaic

Use when a drone or a low overhead shows one flat colour, or flat neon tiles, where the biome is vegetated.

## 400–2000 m is a photograph, not another noise pass

Five procedural passes (crowns, ponds, fen rings, luma matching) produced camouflage and green static. Stop. Proland and flight sims keep the height field and the land-cover weights, and take colour from a few real aerial photographs, one per cover.

1. Crops live in `public/aerial/`. They are samples of canopy, fen, shore, and open water, not a map draped on the game point. Licence and tile indices are `public/aerial/CREDITS.md` and `meta.json`. Rebuild with `tools/bake-aerial-exemplars.py`. Canopy is a 1024 px NAIP export at about 1 m per pixel (`canopyMetres`, its own repeat). Fen, shore, and water stay the 128 px zoom-16 crops on `uExMetres`. The sampler is still `tbSample`. A 128 px crop at 1.6 m per pixel is static under a 400 m camera. `tests/canopy-structure.test.ts` scores correlation 8 m away, and a shuffle of the same pixels (same variance) must not pass.
2. `coverWeights` in `planet.ts` is the same sequence of mixes as `surfaceColour`, stored on the vertex as `aCover`. Do not invent a second biome field in the shader.
3. Repeats use Deliot and Heitz, GPU Zen 2 (2019). The GLSL is `tilingBlend.glsl.ts`, ported from Error-mdl/UnityGaussianTex (BSD-3-Clause): triangle-grid offsets, variance-preserving blend, per-channel Gaussian plus a lookup table. Do not write a new hash blender.
4. Water is the height contour (`landMask` from `F`). Do not punch ponds. Forest meets the water. A broken grey margin, and only the odd sandy spot, sits in the first metre or two of height. A small wander bends the contour so a coarse quad is not a straight cut.
5. The globe sun crushes a raw photograph used as a 3% albedo. `uExGain` (2.5) is the exposure that landed near the EOX tile. It is a uniform.
6. A 2000 m frame that is one cover is a carpet. Mix conifer, deciduous, fen and rock with noise at about 280–880 m, and with height (wet hollows, a thin shore). At that distance sample a lower mip so the 1.6 m crowns are not a grain. `largeScaleStd` in `tests/aerial-exemplar.test.ts` fails a 200 m block field whose means barely move.
7. Judge the still against real imagery of the biome the game reports, at the same metres per pixel. `tests/aerial-exemplar.test.ts` compares local patches to `tasks/evidence/T-0189/ref-eox-z14.png`. The reference against itself scores 1. The #417 frames fail on orange rings and navy discs. A patch-correlation threshold alone ranked those frames above a real 1.6 m canopy, because Sentinel-2 at 6 m is smoother than crown photographs. Keep both checks.

Below about 120 m and above about 20 km the older stand waves still apply. Do not copy the exemplar path onto the skirt.

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

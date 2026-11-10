# Skill: one cover sample for the HUD and the picture

Use when the landing report and the drawn trees or water disagree.

## Search before writing

1. The report is `landingContext` / `borealLanding`. It already calls `coverSampleLatLon`.
2. The photograph is `samplePhotoVegetation` (EOX Sentinel-2 cloudless 2021, CC BY 4.0, https://s2maps.eu). The height is `sampleDem` (Mapzen terrarium). Do not add a second tile cache.
3. Class thresholds are `data/earth/cover-density.json`: desert below 0.28, prairie below 0.62. Plant height for prairie is 0.4–1.5 m. Black spruce in `treeSpecies.ts` is 9–15 m (Viereck & Johnston 1990).
4. Home longitude is seeded (`planet.ts`), not Kenora's 94.5 W. At seed 1400 it is 65.54 E. The Kenora stand (`standAt`) and the open-water plane (`waterMaterial`, 0x578d91) are not that place.
5. Off home, `SITE.treeShare` already thins chunk trees (`world.ts`, T-0127). Home used to keep share 1 so the chunk digest stayed put.

## Steps

1. Read `coverSampleAt(x, z)`. It uses the landed frame when `SITE.latDeg` is finite, otherwise `planet.fromLocal`. Same direction as the HUD.
2. Install `installPictureGate` from the scene. `generateChunk` thins spruce and logs on that share, and scales a stem by `heightM / 12` when the cover row is shorter than 9 m. With the gate unset, the share is 1 and the pinned chunk digest does not move.
3. Far filler stems use the same share. Horizon billboards and the skirt's closed-canopy weight use `coverSampleAt`. The flat teal plane is added only when `drawOpenWater` is true. `mountChunkWater` always adds the staged lake and river sheet (`t.water`) when the terrain job built one. `isDryLand` still treats those cells as water.
4. `placeTree` is keyed. A second call with a new scale rewrites the matrix. Do not call `dropPlacedTrees` on a cover change: that clears near-chunk trees from `trees.ts` (placed with `far=false`), and those chunks are not rebuilt when only the tier key changes, so the near trees stay gone until reload. `dropFarTrees` drops the far filler. The far filler also resets on its own cover key.
5. The cover tier token is biome, water, and a vegetation decile with hysteresis (`coverTierToken`, `holdVegetationDecile`). The deadband is `VEG_HYST` 0.02, one fifth of the decile, the same fraction `WOLF_LOD.hyst` is of the 0.5 share threshold (Schmitt 1938). `floor(vegetation * 10)` chatters when a walk sits on the edge. Named river and pond sheets still come from `terrainCore`.

## Checks

- `tests/cover-sample.test.ts` stores the measured steppe pixel and a 216 m DEM, then fails if the HUD and `coverSampleAt` disagree, if prairie still keeps a closed stand, or if `drawOpenWater` is true on the wet Kenora origin. It also fails if a dry chunk-centre sample mounts no staged sheet, if a near tree disappears on `dropFarTrees`, or if vegetation 0.299 and 0.301 flip the tier token.
- `tests/proc.test.ts` still pins the ungated chunk digest.
- Frame: `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. Wait until `borealLanding` says prairie. The open water and the closed spruce stand should be gone. A few short stems are the prairie share, not a failure. Floating ground plates are a different defect.

## Mistakes to avoid

- Do not retarget the home longitude to Kenora to make the report say boreal. The report is the place. The picture follows it.
- Do not thin inside `generateChunk` unconditionally. The digest test does not load this gate.
- Do not call `placeTree` and expect a new scale to stick. The key returns early unless the matrix is rewritten, and trees that the new chunk omits stay until something drops them.
- Do not gate `t.water` on `drawOpenWater`. That hides a real river under a dry chunk-centre sample while `isDryLand` still refuses stems there.
- Do not put `floor(vegetation * 10)` on the tier key. A walk along the decile edge drops and refills the far set on every step.
- Do not treat the gap between floating plates as a lake. That gap is the held ground-plate defect. Sample the pixels. The water shader is teal (about 87, 141, 145), not the pale haze.

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
3. Far filler stems use the same share. Horizon billboards and the skirt's closed-canopy weight use `coverSampleAt`. The teal open-water plane is added only when `drawOpenWater` is true.
4. `placeTree` is keyed. A photograph that arrives after the first chunks must drop the old instances (`dropPlacedTrees`) or the full-size spruce stays. Put the biome and a coarse vegetation bucket on the chunk key so the reload happens once.
5. Named river and pond sheets still come from `terrainCore`. The river tests build that mesh directly. The scene hides them when the sample says dry.

## Checks

- `tests/cover-sample.test.ts` stores the measured steppe pixel and a 216 m DEM, then fails if the HUD and `coverSampleAt` disagree, if prairie still keeps a closed stand, or if `drawOpenWater` is true on the wet Kenora origin.
- `tests/proc.test.ts` still pins the ungated chunk digest.
- Frame: `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. Wait until `borealLanding` says prairie. The open water and the closed spruce stand should be gone. A few short stems are the prairie share, not a failure. Floating ground plates are a different defect.

## Mistakes to avoid

- Do not retarget the home longitude to Kenora to make the report say boreal. The report is the place. The picture follows it.
- Do not thin inside `generateChunk` unconditionally. The digest test does not load this gate.
- Do not call `placeTree` and expect a new scale to stick. The key returns early unless the matrix is rewritten, and trees that the new chunk omits stay until something drops them.
- Do not treat the gap between floating plates as a lake. That gap is the held ground-plate defect. Sample the pixels. The water shader is teal (about 87, 141, 145), not the pale haze.

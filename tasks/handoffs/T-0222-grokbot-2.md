# T-0222 handoff

Branch `grokbot-2/prairie-aerial`, off main `8051065f`. Pull request #490 stays a draft. Do not mark it ready.

## Doing

The 2000 m overhead was a flat tan blur, and a fresh load with no Sentinel tile fell back to boreal salt.

## Done

- The standalone globe and the in-page path set `uOpenLand` from `openLandHere`. Within 6° of the staged home that is prairie even when the nadir pixel is a lake or no photograph is cached. Overhead crowns stay off, so the litter quad does not paint green salt.
- With a cached Sentinel tile, the overhead samples a 3×3 zoom-14 mosaic (mipmapped, `textureLod` 0). Hillshade and slope come from `demSlope`. Drainage lines are `soilAt` flow distance, stored in the atlas alpha. Lakes are not darkened as a fill. A per-channel lift around 0.38 was removed: it clamped the linear green and blue and the land went red.
- With no tile, the open-land colour is the prairie thatch, and the horizon skirt uses `prairieGround` (DEM slope, wetness, flow distance) instead of the canopy repeat.
- Check: `tests/prairie-aerial.test.ts`. Before frame fails the straw test. After frame passes. 32 px window std 6.85 against the reference 9.44. A cleared photo cache at the staged home is still open land. `npx tsc --noEmit` passed.

## Next

Matthew views `tasks/evidence/T-0222/after-2000.png` beside `ref-steppe-sentinel.jpg` before anyone marks #490 ready.

## Needs from another agent

None.

## Limits

The photograph is magnified at 2000 m (zoom 14 is about 6 m per texel, the frame is about 1.3 m per pixel), so the field reads as the satellite pixel. The orbit limb is not this task. Gait was not touched.

# T-0215 grokbot-2

D28. Branch `grokbot-2/ocean-landing`. T-0211 is already on PR #438. This id is T-0215, the next free id above T-0214.

## Done

`sampleSurface` in `planet.ts` is the seeded relief. At 8.487 N, 129.334 W it returns h = 5074.600593151878, kind land. `radial.ts` `surfaceRadius` is figure + that, because water is -Infinity. The zoom-0 terrarium pixel is -4589 m. The ice line at 8.5 N is 4633 m, so the class was ice. Vegetation 0.92 was `vegetationFromPhoto` on a blue pixel (the formula starts at 0.55), not a canopy.

`planetFor(..., coasts=true)` applies that grid outside the 450 km home lift. A negative pixel becomes ocean (h = the depth, water = 0). A positive pixel the seed called ocean becomes that land, so the playable planet's land share stays 0.267 (within 4 points of 0.292). `createPlanet` is unchanged, so the hypsometry, relief, lake, and seed-difference tests still see the generator. The climate boot stays on `planetFor` without coasts, so the NSIDC October extent test is unchanged.

The landing, the HUD (`landingContext`), and `globePlanet` use the coast. Ocean feet stay at `LEVEL.waterSurface - 2` (`landingSite.ts`). `treeShare` is 0. `landingShore.ts` does not move an open-ocean aim. Datum is 0, so elevation is sea level, not the sea floor.

## Frames

`tasks/evidence/T-0215/`. Before ground band white fraction 0.81, mean RGB 223, 222, 219. After white fraction 0, mean 75, 124, 117. HUD after: water, 0 m, vegetation 0, lat/lon matches the click. Reference mean sRGB 16, 28, 51 (`ref-pacific-z7.jpg`). The glide is still a flat field. That is T-0216.

## Check

`tests/ocean-bathymetry.test.ts`. With the coast off, the direction is still the 5074 m mountain. With it on, `surfaceRadius` is the figure, the HUD is water at 0 m, and the feet stay at the aim.

## Next

T-0216: the band camera still uses the home frame, so the glide does not show this ocean.

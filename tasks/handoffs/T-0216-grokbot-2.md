# T-0216 grokbot-2

D29. Branch `grokbot-2/glide-terrain`, stacked on T-0215 `grokbot-2/ocean-landing`.

## Done

`gameToPlanet`, `planetToGame`, `gameBasis`, and the hemisphere test use the landed site when `SITE.remote` is set. Datum is the landing datum. At 8.487 N, 129.334 W that is 0, so a game height of 400 m is 400 m above the sea, on the aim.

The pale glide (RGB 227, 228, 223) became the ocean colour (about 16, 25, 41). The Sentinel-2 tile of that point averages 16, 28, 51. The HUD on that glide is water, elevation 0, vegetation 0, the same sample as the landing.

## Check

`tests/glide-site-frame.test.ts`. `tests/viewpoint.test.ts` still round-trips the home frame.

## Leftover

The landed frame still has a few spruce on the far bank. `coverSpots` for this water sample is empty and `isDryLand` is false. Those meshes are not this camera change.

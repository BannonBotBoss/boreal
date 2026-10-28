# T-0110 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-elevation`. Issue #156 step 2. Blitz mode #157.

## What was built

- `src/world/globe/openTiles.ts` caches AWS Terrain Tiles (terrarium). Zoom 8 covers the horizon, zoom 11 the valley. A missing tile stays null and the planet height remains.
- The skirt blends to that height past about 1.6 km. Water is not replaced. The inner 200 m stays the planet, so the chunks do not become a cliff.
- `HORIZON_SKIRT.discCover` is 0.7. The dither finishes inside the loaded square. The corners that made the prairie rectangle are discarded.
- Photographs are decoded by the same module and are not fetched on this step.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Encoding | (R×256 + G + B/256) − 32768 | AWS Terrain Tiles / joerd | yes |
| Denver, zoom 8, one pixel | 1606 m | About 1609 m city datum | yes |
| Blend | 200 m planet → 1600 m DEM | [game calibration] | labelled calibration |
| Disc | 0.7 × loaded radius | [game calibration] | labelled calibration |
| Licence | see `OPEN_TILES_CREDIT.dem` | joerd attribution.md (USGS public domain, Copernicus EU-DEM, Canada OGL, and the rest of that list) | yes |

## Frames

`tasks/evidence/T-0110/capture.mjs`, same places as T-0108, after the DEM fetch (settle waits 8 s). Headless Chrome, swiftshader.

| Still | What is on screen |
| --- | --- |
| `prairie-low.png` | The rectangle is gone. A curved, dithered shoreline crosses the lower frame. Flat dark water above it, a pale sky at the top. The dither is a stippled band, not a photograph of a coast. |
| `home-low.png` | Blocky terraces and a lake. That is the terrarium sampled onto the coarse rings: real relief, visible steps. A dithered edge remains along the near water. Not a drone photo. |
| `boreal-glide.png` | Flat dark blue. At 400 m this pitch still does not show a readable landscape. |
| `home-glide.png`, `prairie-glide.png`, `boreal-low.png` | With the set above. The glide frames stay dark and flat. |

## Verdict

Not a drone photo. The prairie rectangle is gone, replaced by a dithered curve, and home-low shows measured terraces instead of the old smooth blob. The terraces are coarse, the colour is still the dark globe albedo, and the glide frames do not read as landscape. Uncalibrated. These frames would not pass a look score.

## Leftovers

Ground colour is still `surfaceColour`. Water has no reflection. Trees are still the chunk instances. The seeded home longitude is not geographic Kenora; the DEM is the real Earth at the lat/lon the globe uses.

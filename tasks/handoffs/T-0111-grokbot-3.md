# T-0111 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-imagery`. Issue #156 step 3. Blitz mode #157.

## What was built

- `warmPhotoTiles` fetches EOX Sentinel-2 cloudless 2021 (CC BY 4.0) at zoom 8 and 12.
- Land colour is `blendPhoto`: the mosaic times a procedural grain inside 50 m, the mosaic alone by 700 m. No mosaic keeps `surfaceColour`.
- A missing bilinear neighbour no longer drops the whole zoom.
- Water uses the mosaic, then Schlick Fresnel, F0 = 0.02, mixed toward the skirt haze and capped at 0.85. The haze itself is unchanged.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Mosaic | s2cloudless 2021 | EOX, CC BY 4.0, https://s2maps.eu, modified Copernicus Sentinel data | yes |
| F0 | 0.02 | ((1.33−1)/(1.33+1))², already `fresnelF0` in `src/world/globe/tile.ts` | yes |
| Grain | 50–700 m | [game calibration] | labelled calibration |

## Frames

`tasks/evidence/T-0111/`.

| Still | What is on screen |
| --- | --- |
| `home-glide.png` | A blocky green and blue mosaic, like a low zoom satellite image draped on coarse triangles. Large black regions sit between the coloured patches. Not a drone photo. |
| `prairie-low.png` | Pale sky, dark water, a dithered curved shore. The rectangle is still gone. No bright grazing reflection is obvious at this pitch. |
| `home-low.png` | Still the terraced DEM and the dither, more than a photograph. The near view is inside the grain distance and the mosaic is not yet the whole picture. |

## Verdict

Not a drone photo. The glide does show real land and water colour from Sentinel-2, which the procedural albedo did not. It is a coarse mosaic with black gaps and hard triangle edges. Uncalibrated. It would not pass a look score.

## Leftovers

Trees and the prairie/tundra/desert billboards are the next step. The black gaps are where a tile did not cover a vertex; the clamp stops a missing neighbour from dropping a zoom, and it did not remove every gap.

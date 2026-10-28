# T-0114 handoff (grokbot-3)

Branch: `grokbot-3/eco-front-photo-gaps`. Issue #156, the black gaps. Blitz mode #157.

## What was built

- `ImageBitmap.close()` was called before the width was read. Every decoded tile was stored as a zero-length buffer. Sampling it produced NaN, and NaN vertex colours draw as the black polygons between the coloured patches.
- Tiles decode four at a time. A burst used to fail together and then stay cached as a hole. A new landing drops the queued tiles of the previous one so the horizon is not stuck behind them.
- Zoom 8 is a 5×5 around the camera (the horizon). Zoom 10 is the step between. Zoom 12 is a small valley, not an 11×11 that blocks the next landing.
- A missing photograph uses `globeMatch` (the globe palette, lifted so it is not black). The skirt shader replaces that fragment with the far-layer globe texel when the far depth shows the globe drew land there.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Home glide pixels with max channel under 18 | 0.81 in T-0111, 0.00 in T-0114 | Counted on the PNGs, rows 40–90 %, step 3, skipping the menu | measured, not a look score |
| Home glide mean sRGB | 121, 90, 53 | The zoom-8 tile at this seeded longitude averages about 108, 86, 56. It is steppe, not the reference forest | the mosaic arrived |
| Reference mean sRGB | 72, 78, 74 | Wasson Lake aerial, public domain, `tasks/evidence/drone-ref/` | the game is a different place and still blocky |

## Frames

`tasks/evidence/T-0114/`. Side by side with the reference: `home-glide-beside-ref.png`, `home-low-beside-ref.png`.

| Still | What is on screen |
| --- | --- |
| `home-glide.png` | Continuous tan and olive ground. No black polygons. The colour changes in large soft facets. It is a satellite mosaic on a coarse mesh, not a drone photo. |
| `home-low.png` | The same tan ground, dark rectangular billboards, and a dithered square where the near chunks meet the mosaic. |
| `boreal-glide.png` | One dark green. The tile arrived (`photoShare` 1) and the triangles are so large it reads as a flat colour. Still dark next to the reference. |
| `prairie-low.png` | Dark green water and a dithered cyan shore. The planet still calls this ocean. That is the next bug, not a missing tile. |

## Verdict

The black gaps are gone at the home landing. The ground there is a continuous photograph. It does not look like the Wasson Lake picture: the mesh is still a few huge facets, the trees are still dark rectangles, and the northern and prairie views are still far too dark. Uncalibrated. It would not pass a look score.

## Leftovers

Finer rings, geomorphing, and normals from the elevation model. Tree impostors. A brighter sky and exposure. Trust the elevation model when it says land and the planet says ocean.

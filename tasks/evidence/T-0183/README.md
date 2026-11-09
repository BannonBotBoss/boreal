# T-0183 frames

SwiftShader, 1280×720. The game reports the spot.

| frame | place the game reports | what the crop says |
|---|---|---|
| `before-400.png` | boreal, 52.00 N, 97.00 W, vegetation 0.93, day 227, hour 8.3, sun 32°, clear day | one green. luma spread 0.3, 2 bins |
| `after-400.png` | same place, after the far layer stays full size and the stand mosaic runs | not one fill. luma spread 5.5, 6 bins |
| `before-prairie.png` | prairie, 49.77 N, 65.54 E, vegetation 0.33, same morning | soft yellow-brown polygons |
| `after-prairie.png` | same prairie glide | still soft colour; the boreal one-fill is the gate |
| `globe-400.png` | `?view=globe&alt=400&latlon=52,-97` | the same mosaic at full resolution, darker (no drone exposure) |

The crop is the upper-left ground, x 8–40 % and y 8–42 %, so the prompt and the layer panel are not in the number. `tests/drone-fill.test.ts` reads the before and after boreal frames.

Reference for what that boreal looks like from above: Sentinel-2 cloudless 2021, EOX IT Services GmbH, CC BY 4.0, https://s2maps.eu (the tiles `openTiles.ts` already fetches). Drusch et al. 2012, Remote Sensing of Environment 120, the 10 m pixel. A true-colour boreal is mottled stands, not one green. The prairie at 49.8 N, 65.5 E is dry steppe in August, tan and olive, not a closed canopy. The after frame is mottled. It is not yet a photograph of that canopy.

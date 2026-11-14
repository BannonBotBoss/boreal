# T-0187 frames

SwiftShader, 1280×720, tier 5 (the headless GPU lands on Minimum). `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5`. Tiles were in to about a 5 km edge before the shot.

The game at that drop is boreal, 52 N, 97 W, day 227, morning.

| frame | centre-crop mean luma | red-dominant | green-dominant |
|---|---|---|---|
| `before-globe-2000.png` | 19.5 | 6.2% | 75% |
| `after-globe-2000.png` | 39.0 | 0 | 100% |
| `before-globe-400.png` | the T-0185 dot field | | |
| `after-globe-400.png` | 35.2 | 0 | 99.7% |
| `ref-eox-z8.png` | 38.9 | 0 | 99.6% |

Red-dominant is red above green by more than 8 and above blue by more than 8. The before 2000 m frame is `tasks/evidence/T-0184/after-globe-2000.png`. The before 400 m frame is `tasks/evidence/T-0185/after-globe-400.png`.

## Why it was black

The stand shader wrote MODIS-like reflectance (conifer `0.020, 0.034, 0.016`, fen `0.090, 0.062, 0.028`) into a `MeshStandardMaterial`. The globe sun is intensity 3.2 and Lambert divides by π (`lights_physical_pars_fragment.glsl.js`). ACES exposure on the standalone globe is 1. That fen is redder than it is green, so the only lighter patches read red. A luma-spread test passed the noise.

The gate on `fwidth` of the tile position did not track metres per pixel, so a later albedo edit never reached the frame until the gate moved to `length(vViewPosition)`.

## Why there is no blue lake in these two frames

`aLake` is set where `surf.level > 0.5` (`tile.ts`), which is most dry land. Painting that as water turned the whole 2000 m frame blue (measured 99% blue-dominant) and was reverted. Open water is the height field below its level. In this nadir, after the tiles had refined, that field did not cross into water, so the crop has no blue-dominant pixels. The aerial band no longer forces a real depression to land (`uHideLake` is off while the eye is between about 120 m and 20 km).

## Reference

EOX Sentinel-2 cloudless 2021, Web Mercator z8 y84 x59, which covers 52 N, 97 W. CC BY 4.0, EOX IT Services GmbH, https://s2maps.eu. The 10 m pixel is Drusch et al. 2012, Remote Sensing of Environment 120. The committed PNG is that JPEG decoded. Its centre-crop mean luma is 38.9 and its red-dominant share is 0. The 2000 m game frame lands on luma 39 and red 0.

# T-0190 frames

SwiftShader, 1280×720, tier Minimum. `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400`.

The spot is seed 1400, 52.00 N, 97.00 W. `sampleSurface` there is land, height 78.5 m, water level 43 m, hill 0.85 (a ridge), cover boreal. In a 6 km box only about 0.7% of samples are under the water level, so this frame is canopy, not a lake.

| file | what |
|---|---|
| `after-globe-2000.png` | game, 2000 m. Ground width 2 × 2000 × tan(22.5°) = 1656 m, 1.29 m per pixel |
| `after-globe-400.png` | game, 400 m. Ground width 331 m, 0.259 m per pixel |
| `side-2000.png` | game on the left, `tasks/evidence/T-0189/ref-eox-z14.png` on the right, scaled so both are 1.29 m per pixel |
| `side-400.png` | the same at 0.259 m per pixel. The reference is Sentinel-2 at about 6 m per pixel, so the right half is that tile enlarged until the metres match |

Reference: EOX Sentinel-2 cloudless 2021, CC BY 4.0, https://s2maps.eu, Web Mercator z14 / y5484 / x3868, about 6.0 m per pixel at 51°. Not this coordinate and not Kenora.

Exemplars: USGS Imagery Only (NAIP), public domain, zoom 16, about 1.6 m per pixel, northern Minnesota. Crops and the Gaussian lookup are in `public/aerial/`. See `CREDITS.md`.

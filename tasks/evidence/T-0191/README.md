# T-0191 frames

SwiftShader, 1280×720, tier Minimum. `?view=globe&shot&localClouds=0&hour=8.3&day=227&tier=5&seed=1400`.

The ridge is seed 1400, 52.00 N, 97.00 W. Height 78.5 m, about 35 m above the local water level, so that frame has no lake. The lake frame is 51.964 N, 97.047 W, about 5 km away, where the same height field is under water on roughly a third of a 1.6 km window.

| file | what |
|---|---|
| `carpet-2000.png` | the first 2000 m still: one grassy carpet. The large-scale test fails it. |
| `after-globe-2000.png` | 52.00 N, 97.00 W at 2000 m. 1.29 m per pixel. Darker conifer, a lighter stand, pale clearings. |
| `after-globe-400.png` | the same spot at 400 m. 0.259 m per pixel. Crowns. |
| `after-globe-2000-lake.png` | 51.964 N, 97.047 W at 2000 m. Lakes from the height field, a pale shore, forest between them. |
| `side-2000.png` | ridge beside `tasks/evidence/T-0189/ref-eox-z14.png`, both at 1.29 m per pixel |
| `side-400.png` | the same at 0.259 m per pixel. The reference is 6 m data, so the right half is soft. |
| `side-2000-lake.png` | the lake frame beside the same reference, both at 1.29 m per pixel |

Reference: EOX Sentinel-2 cloudless 2021, CC BY 4.0, https://s2maps.eu, z14 / y5484 / x3868, about 6.0 m per pixel at 51°. Not these coordinates and not Kenora.

Exemplars: USGS Imagery Only (NAIP), public domain, zoom 16, about 1.6 m per pixel, northern Minnesota. `public/aerial/CREDITS.md`.

# T-0189 frames

SwiftShader, 1280×720, tier Minimum. `?view=globe&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227&tier=5`. The nadir tile refined to an edge of 4882 m before the shot (level 11).

The spot is seed 1400, 52.00 N, 97.00 W. `sampleSurface` there is land, height 78.5 m, vegetation 0.70, cover class boreal, day 227 so phenology colour 0 and leaf-off 0 (`src/core/treeSpecies.ts`). Ground −6060 m on the HUD is the hydrostatic figure under the mean radius (6371 km) plus that 78 m, not a hole.

| file | what |
|---|---|
| `before-globe-2000.png` | main `af2ccd98`, the smooth green |
| `before-globe-400.png` | the same at 400 m |
| `after-globe-2000.png` | crowns, fen, deciduous, blue ponds |
| `after-globe-400.png` | the same land closer: crowns, a fen, a pond in the corner |
| `ref-eox-z14.png` | EOX Sentinel-2 cloudless 2021, CC BY 4.0, https://s2maps.eu — Web Mercator z14 / y5484 / x3868, centred near 51 N, 95 W. Metres per pixel = 156543.03392 × cos(51°) / 2^14 ≈ 6.1. Not the game point and not Kenora. |

`tests/overhead-stand.test.ts` `aerialStructure` is the gate. The T-0187 frames (luma matched to zoom 8) fail it. These after frames pass it.

Recorded on the same main, not fixed here:

| file | what |
|---|---|
| `ground-floor.png` | Wolf spawn. The landing report is prairie, vegetation 0.33, no water. The ground is a flat green lawn, the sky is a pale sheet, the pups are smooth tan shapes, the wolf is blown white. |
| `ground-40.png` | Same spot with the eye held at 40 m. The spruce are repeated stacked cones. Trees v2 had 4 black spruce (2 mid, 2 far, 0 crown). The cones are the other tree draw. |

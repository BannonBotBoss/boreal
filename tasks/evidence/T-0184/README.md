# T-0184 frames

SwiftShader, 1280×720. `?view=globe&alt=2000&latlon=52,-97&shot&localClouds=0&hour=8.3&day=227`.

The game at that drop reports boreal, 52.00 N, 97.00 W, day 227, morning, sun elevation about 35°.

| frame | what the centre crop says |
|---|---|
| `before-globe-2000.png` | one soft dark fill. luma spread 2.35, 6 px step 0.81 |
| `after-globe-2000.png` | fen and conifer stands. luma spread 3.62, 6 px step 1.48 |
| `before-drone-2000.png` | the drone at the same spot, before this change, was a soft olive with no stand edge |

Reference: Sentinel-2 cloudless 2021, EOX IT Services GmbH, CC BY 4.0, https://s2maps.eu. A boreal true-colour mosaic is fen, conifer and broadleaf patches at tens to hundreds of metres, not one olive. The 10 m pixel is Drusch et al. 2012, Remote Sensing of Environment 120. Boreal canopy albedo is a few percent (the spruce values in `GLOBE_COLOURS`, MODIS).

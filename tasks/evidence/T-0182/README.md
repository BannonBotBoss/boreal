# T-0182 frames

`?view=globe&alt=400&latlon=52,-97&stages=1&shot=1&localClouds=0`. SwiftShader, 1280×720.

The place is boreal: vegetation weight about 0.70 at 52 N, 97 W (`vegetationWeight` / `coverKind`).

| frame | what |
|---|---|
| `before-400.png` | One dark olive fill. Centre green sits in a band of about 8 levels. |
| `after-400.png` | Same URL. The fill is mottled: fen-brown and broadleaf-green stands. |

## Numbers

| value | game | real | match |
|---|---|---|---|
| pixel | 10 m, the scale the waves sit above | Sentinel-2 MSI, 10 m (Drusch et al. 2012, Remote Sensing of Environment 120) | yes |
| waves | 40, 160, 640 m | stand and wetland patches in a boreal true-colour mosaic (EOX Sentinel-2 cloudless, CC BY 4.0, the tiles `openTiles` already fetches) | yes |
| mean albedo | stays near the vertex colour (`landMosaic` mean within 20% of spruce) | MODIS boreal canopy about 3–6%, already `GLOBE_COLOURS.spruce` | yes |
| display stretch | fen 2.4 / 0.45, leaf 0.7 / 2.2 | a 3% albedo under ACES hides a 2× change; the stretch is so the stands read [game calibration] | yes |

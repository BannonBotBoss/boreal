# Aerial cover exemplars

Samples of boreal cover, not a map of any game coordinate.

USGS Imagery Only, which is National Agriculture Imagery Program (NAIP) photography.
Public domain. Served by The National Map:

https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer

Fen, shore, and open water are zoom 16, about 1.6 m per pixel, 128 px, near 48 N
in northern Minnesota. Canopy is a 1024 px export of the same service, 1024 m on a
side, so about 1 m per pixel, centred near 48.094 N, 91.482 W (a closed stand about
1.6 km east of the old 128 px crop). NAIP on this service is about 1 m; finer zoom
tiles are not in the cache. `source/` is the photograph. The files next to
this note are the per-channel Gaussian and `lut.png` is the table back to sRGB,
the 1D histogram transform from Thomas Deliot and Eric Heitz, "Procedural Stochastic
Textures by Tiling and Blending", GPU Zen 2, 2019. The shader is
`src/world/globe/tilingBlend.glsl.ts`, ported from
https://github.com/Error-mdl/UnityGaussianTex (BSD-3-Clause).

`meta.json` records the tile indices and the metres across one crop.
`tools/bake-aerial-exemplars.py` rebuilds the files.

The side-by-side reference stays the EOX Sentinel-2 cloudless 2021 tile already in
`tasks/evidence/T-0189/ref-eox-z14.png` (CC BY 4.0, https://s2maps.eu). That tile is
what the same biome looks like from Sentinel-2. It is not draped on this planet.

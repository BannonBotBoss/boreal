# T-0215 frames

Same pose both times. SwiftShader, Chrome, 1280×720. URL `/?start=globe&stages=1&trees=v2&latlon=8.487,-129.334&hour=9.2`. G drops on that centre. G again becomes the wolf.

The aim is 8.487 N, 129.334 W. Zoom-0 Mapzen terrarium pixel (36, 121) is -4589 m (ETOPO1 via joerd; Amante and Eakins 2009). Day 227, about 09:45, sun elevation about 57°, snow 0 cm.

| frame | HUD | picture |
|---|---|---|
| `before-orbit.png` | globe, over the aim | A dark ocean with one white ice island under the camera. |
| `before-glide.png` | not yet the site | A flat pale field. The line is "Gliding above the land". No horizon. |
| `before-landed.png` | ice, 5074 m, vegetation 0.92, water false | A clipped white sheet. Ground band (y 420–640, x 360–980) mean RGB 223, 222, 219. White pixels (each channel > 220) are 0.81 of that band. |
| `after-orbit.png` | globe, same aim | The white island is gone. The nadir pixel is RGB 32, 37, 51. Real continents show in the hemisphere. |
| `after-glide.png` | water, 0 m, vegetation 0 | Still a flat field, now light blue. No horizon. That is T-0216. |
| `after-landed.png` | water, elevation 0, vegetation 0, lat 8.487 N, lon 129.334 W, click matches the aim | Teal water under the wolf (`waterMaterial` 0x578d91). The same ground band has mean RGB 75, 124, 117 and white fraction 0. The prompt is "E / click · drink". |

Reference `ref-pacific-z7.jpg` and `ref-pacific-z5.jpg`: Sentinel-2 cloudless 2021 by EOX (CC BY 4.0), tile z7/y60/x18 and z5/y15/x4. Mean of the z7 tile is sRGB 16, 28, 51. Open ocean, no ice, no land. The game's near water is the shared teal plane, not that navy. The orbit nadir (32, 37, 51) is the closer match. The class is water, not ice.

A line of spruce still reads on the far bank of the landed frame. `coverSpots` for this site is empty and `isDryLand` is false (`tests/ocean-bathymetry.test.ts`). Those meshes are not this sample.

# T-0216 frames

Same URL as T-0215. `/?start=globe&stages=1&trees=v2&latlon=8.487,-129.334&hour=9.2`. SwiftShader, 1280×720. The shot is the first frame after the line says "Gliding above the land", held 10 s on the after frame so tiles can arrive.

The aim is 8.487 N, 129.334 W. The landing HUD on that glide is water, elevation 0, vegetation 0. Day 227, sun about 57°, snow 0.

| frame | centre band RGB (x 200–1000) | what it is |
|---|---|---|
| `before-glide.png` | 227, 228, 223 at every row | The empty pale field. No horizon. |
| `before-coast-glide.png` | 133, 192, 210 | After the sea landing, before this camera fix. Still a flat field, now the sky blue. The camera was still on the home frame. |
| `after-glide.png` | about 16, 25, 41 from the top row to the bottom | The open ocean. Sentinel-2 cloudless z7 of this tile (`ref-pacific-z7.jpg`) averages sRGB 16, 28, 51. There is no coastline in that tile, so the frame has no shoreline. It is not the pale field. |

The check is `tests/glide-site-frame.test.ts`: the camera direction matches the aim and the radius is 400 m above sea level, not inside the 5074 m mountain.

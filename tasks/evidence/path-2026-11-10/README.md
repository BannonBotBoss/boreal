# Path on main 7f256748

SwiftShader, 1280×720. Frame times are not hardware FPS.

The HUD at the seeded home: prairie, vegetation 0.33, water false, 49.77 N, 65.54 E, elevation 216 m, day 227, sun about 34–37°, snow 0. Census: red fox.

Reference for that biome, not that exact coordinate: Vmenkov, 10 September 2007, steppes of Akmola Province, about 30 minutes north of Astana by train. `ref-astana-steppe.jpg`. Wikimedia Commons, CC BY-SA 3.0. https://commons.wikimedia.org/wiki/File:Astana-steppe-7748.jpg

| frame | what it shows against that steppe |
|---|---|
| 02-today.png | The opening reaches "Today · 13.8 billion years". A globe, not the steppe. |
| 03-handoff.png, 05-orbit.png | The globe is in hand. Drag orbits, G drops. |
| 04-overhead-2000.png, 04-overhead-800.png, 04-overhead-400.png | Green lake mosaic and, at 400 m, pixel noise. Not the tan grass of the reference. This is the held crown defect (#429). |
| 06-descent-400.png | The glide is a flat noisy sheet with a hard edge. Same held defect. The script's first height sample was already 400 m, so 2000 and 800 were not separate descent frames. |
| 07-landed.png | Wolf and pups on a flat teal sheet. Pups are the known smooth-tan defect. The sheet is D27 (#433). |
| 08-eye-40.png, 10-floor.png | Prairie HUD, spruce poles and a cone, floating plates, flat blue horizon. Poles are T-0202. Plates are #428. Horizon is #422. |
| 09-treetop.png | Same stand from the treetop eye. |
| 11-floor-walk.png | After an 8 s W hold the clock moved from 08:43 to 08:45. The control line is on screen. |

Console: one SwiftShader warning, `KHR_parallel_shader_compile` is not supported. No page error. Audio context was suspended on the opening page and running during the descent. Median frame time was about 150–1180 ms.

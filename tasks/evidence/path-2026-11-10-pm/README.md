# Path on main 28fad190, evening of 2026-11-10

SwiftShader, Chrome, 1280×720. Frame times below are software GL, not a player GPU. No page errors were recorded. The sound button read "Sound on". The audio context reached `running` and also flipped to `suspended`. Nothing was heard from this machine.

The opening is `/?start=sphere&stages=1&trees=v2`. The film was clicked and left alone until the counter said Today. Then the globe was dragged and G was pressed.

| frame | HUD at that moment | what the picture shows | reference |
|---|---|---|---|
| `01-opening.png` | not on screen yet | A black field and the line "Click or press any key to begin." | not a biome |
| `02-today.png` | counter "Today", hero "Today · 13.8 billion years" | A day-side planet: blue ocean, green land, white caps, stars. | `ref-earth-apollo17.jpg`. Apollo 17, NASA, public domain. https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg |
| `03-handoff.png` | globe in hand. "Drag orbits. G drops on the centre." | The same day-side disc, smaller in the frame. | same Apollo 17 frame |
| `05-orbit.png` | still the globe | After the drag the disc is the night side: a thin bright limb and a nearly black face. Landforms are gone. | a night-side Earth is not the Apollo 17 day frame. This picture does not show the day-side reference. |
| `04-overhead-400.png` | mode band, height 400 m. The prairie HUD had not moved yet. | A flat pale field. No ground, no clouds, no horizon. The help text says "Gliding above the land." | not comparable to a landscape photo. The view is empty. |
| `06-descent.png` | mode band, height 402 m, biome ice, 8.49 N, 129.33 W, elevation 5074 m, sun about 48° | Almost black, with a pale sky sliver at the top. The land is not visible. | same miss. The drop never showed a height of 2000 m or 800 m. The first sample that matched was already 400 m, and the height then stayed near 402 m. |
| `07-landed.png`, `10-floor.png` | game mode, ice, water false, vegetation 0.92, 8.49 N, 129.33 W, 5074 m, day 227, about 09:14, sun about 49°, snow 0 cm | A clipped white sheet, a dark blue band, the wolf and four pups. No relief, no sky gradient, no ice texture. | `ref-greenland-ice.jpg`. The surface of the Greenland Ice Sheet, CC BY 3.0. https://commons.wikimedia.org/wiki/File:The_surface_of_the_Greenland_Ice_Sheet.jpg The game point is not Greenland. It is a generated 5074 m surface near the equator. The photo is the reference for sunlit ice: grain, melt, and shade. The game frame is one white value (about 243–248) with a dark band. |
| `11-floor-walk.png` | 09:16, same ice point, stamina 74 | The wolf and the pups are in new places. The sheet is still white. A 3.5 s W hold did not move the one-minute clock (09:16 before and after). | same ice photo |
| `12-look.png` | same | Another angle of the white sheet. | same |

The seeded home (49.77 N, 65.54 E, prairie, vegetation 0.33, 216 m) is a different picture. It is the `?view=ground` eye, not this drop. Its reference is `ref-astana-steppe.jpg`, Vmenkov, 10 September 2007, Akmola steppe, CC BY-SA 3.0. https://commons.wikimedia.org/wiki/File:Astana-steppe-7748.jpg That comparison is on T-0202, not on these drop frames.

Frame time at the globe was about 400–880 ms. On the ice ground it was about 340–520 ms.

D28 is the white ice sheet. D29 is the empty glide. Neither is #422, #428, #429, or #434. T-0211 owns them. Not fixed in this run: a shader guess without a new frame of this same drop would not be a fix.

# T-0126 ten-site in-page descent, recaptured

Sprint #192, 1 Nov 2026. grokbot-3. Base is main `05cc328` (through #227: wetland, tropical, and tundra cover, the south-coast caribou hole, DEM and photo landing context, near-shore census, and the warmest-quarter tree and ice lines). The frames also include this branch's viewer placement: a longer dry-ground search, landing animals ahead of home deer and hares for the six full meshes, and a second placement if the wolf turns after the list arrives. Cover class, elevation, and the population list are the simulation's. `world/globe/inpage.ts` and `render/sky.ts` were not edited.

SwiftShader (software GL), Chrome headless, 1280×720. `tools/fall-shot.mjs` with `EMBODY=2` and the ten click coordinates from `tasks/evidence/T-0125/matrix.json`. The capture waits until the globe has input, drops, waits until the glide is under 650 m, embodies, and waits until the mode is `game` before the landed frames. A fixed 25 s climb on this machine was still in the band, and the drop key was lost.

Click coordinates are the ten seam sites. Landed coordinates, cover, and the census are `borealLanding` at the stood point. `frameMs` is one `requestAnimationFrame` in the landed page under SwiftShader. It is a software-rendering number. It is not a hardware frame time.

## Species ranges

Species ranges in the simulation cover North America only. A landing outside those ranges shows only the animals `landingPopulation` returns. Where that list is empty, the frame shows no animals. This pass does not add stand-in species for other continents, and it does not drop a species the list includes.

That is why the alpine site (0.5°N, 54°E), the desert (27.4°N, 27.7°E), and the polar site (74.2°N, 50.6°E) have an empty cast. The tropics site is inside the white-tailed deer's tropical row and shows that deer only.

## Hardware graphics

**UNVERIFIED.** No real GPU was available. The WebGL renderer on every site is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. The JS heap in `matrix.json` (`heap.used`, about 350–560 MB) is the browser heap under that software renderer, not GPU memory. Do not read the `frameMs` column as hardware FPS.

## Before and after

T-0125 is the left-hand pair (biome, animals). T-0126 is the right-hand pair. Animals are the ones standing in the first view (at most five). Counts in parentheses are the 5 km census.

| site | click | landed | biome was | biome now | animals were | animals now | software frame ms was | software frame ms now |
|---|---|---|---|---|---|---|---|---|
| boreal forest | 52, -97 | 52.000, -97.000 | boreal | boreal | hare, deer, black bear, eagle, beaver | same five | 305.4 | 13.8 |
| tundra | 64.5, -119.7 | 64.500, -119.701 | ice | rock | none | none | 28.4 | 17.3 |
| alpine | 0.5, 54 | 0.500, 54.000 | boreal | boreal | none | none | 276 | 12.9 |
| coast | 44.3, -122.2 | 44.300, -122.200 | boreal | boreal | hare, deer, fox, eagle, moose | same five | 63.3 | 18.1 |
| desert | 27.4, 27.7 | 27.400, 27.700 | boreal | desert | none | none | 58.6 | 13.7 |
| tropics | -7.1, -67 | -7.100, -67.000 | boreal | tropical | white-tailed deer | white-tailed deer (census 22) | 105.8 | 11.7 |
| ocean edge | 36.6, -121.9 | 36.600, -121.900 | water | prairie | none | deer, black bear, fox | 145.6 | 9.3 |
| polar | 74.2, 50.6 | 74.200, 50.600 | ice | tundra | none | none | 159.9 | 10.7 |
| prairie | 51, -107 | 51.000, -107.000 | rock | prairie | none | hare, deer, fox, eagle, beaver | 336.9 | 11.5 |
| wetland (lake) | 47.9, -104.9 | 47.900, -104.900 | water | prairie | none | hare, deer, lynx, beaver, moose | 41 | 13.4 |

Landed latitude and longitude stay within 0.01° of the click at all ten sites. Lighting at every site is **day** (15 Aug, day 227, clock about 09:07–09:19, sun elevation 26°–49°). `lighting` on each row is the same sun the sky uses at the landed latitude.

Screenshots: `<slug>/landed-01.png` and `<slug>/landed-02.png`. Census, lighting, picture counts, console lines, and the seam note are in each `landing.json` and in `matrix.json`.

## What the frames show

Where the census names animals and they stand on the skyline, the Meshy bodies are in the frame (boreal and coast report `picture.fulls` 6, the five plus the wolf). Canada lynx still has no Meshy file; a procedural body is the fallback, and the lynx was not one of the five at the sites where the list included it except the wetland, where the lynx is one of the five.

The tropics deer is the one animal in the census. Those two frames were taken again after the cast follows a turn of the wolf. In `tropics/landed-02.png` its head and ears break the skyline on the left (`picture.fulls` 2, the deer and the wolf). The body stays a silhouette.

## Seams and lighting

No site shows a tile crack or a height step in the landed frame. Every site has the same unlit black foreground: the ground and the near animals are silhouettes against the sky even though the sun is 26°–49° up and `lighting.state` is `day`. That silhouette is the landed-ground look. It was not changed here.

## Console

Every site logged two lines: `Failed to load resource: the server responded with a status of 404 (Not Found)` (the message does not name a URL) and `THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported` (SwiftShader). Page errors: none. The boreal and coast casts still skinned full meshes.

## For @Grokbot-1

Cover, the population list, the tree stand, and the unlit ground belong on your side. `inpage.ts` and `sky.ts` were left alone.

1. **Tundra** 64.5, -119.7. Cover reads **rock** (was ice) at 376 m with vegetation 0.71, so the census is empty and there is no caribou. The frame shows broadleaf trees and cattails. `tundra/landed-02.png`.
2. **Alpine** 0.5, 54. Cover stays **boreal** at 2166 m. The census is empty because the point is outside North American ranges (see the limitation above). The frame is open sky and one shrub, which does not read as closed boreal forest. `alpine/landed-02.png`.
3. **Desert** 27.4, 27.7. Cover is now **desert** and vegetation 0, and the census is empty. Conifer silhouettes are still on the skyline. `desert/landed-02.png`.
4. **Ocean edge** 36.6, -121.9. The stand is dry **prairie** at 31 m (was water). The census has deer, black bear, and fox, and they are in the frame, which is grass and spruce rather than the sea. `ocean/landed-02.png`.
5. **Polar** 74.2, 50.6. Cover is now **tundra** (was ice) with vegetation 0.83. The census is empty because 50.6°E is outside North American ranges. The frame is a bare skyline and one shrub. No animals were added. `polar/landed-02.png`.
6. **Prairie** 51, -107. Cover is now **prairie** (was rock) at 588 m, vegetation 0.42. The population list is still the boreal set: hare 1209, lynx 7, caribou 1, wolf 1, grizzly 1, plus deer, moose, bear, eagle, beaver, fox. The viewer stands five of that list. The skyline is a spruce stand. `prairie/landed-02.png`.
7. **Wetland** 47.9, -104.9. The point is dry **prairie** at 748 m (was water), so the near-shore census does not run (`shore: false`). The list includes hare, lynx, and caribou. The five in the frame are hare, deer, lynx, beaver, and moose, as silhouettes among spruce on dry ground. `wetland/landed-02.png`.
8. **All ten sites.** Day lighting, and the foreground is an unlit black band, so animals read only as skyline silhouettes. Same symptom in every `landed-02.png`.

Coast 44.3, -122.2 still has no caribou in the census. That hole is holding. Grizzly count is 1 and stays inside the five-animal cap (the five shown are hare, deer, fox, eagle, moose).

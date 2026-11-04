# T-0127 ten-site in-page descent, recaptured

Sprint #192, 2 Nov 2026. grokbot-3. Base is main `2dc8e20` (2 Nov 2026). That commit is #243, already on main before this capture. The tree includes #231 through #242 (Holarctic second range band, continentality, coast distance, and the coast-distance tree and ice lines) and #243 (tree line shifts with slope and aspect). `world/globe/inpage.ts`, `render/sky.ts`, and the landed-ground lighting were not edited. Animal models were left as they are. Canada lynx still has no Meshy file; the procedural body stays the fallback.

SwiftShader (software GL), Chrome headless, 1280×720. `tools/landing-matrix.mjs` calling `tools/fall-shot.mjs` with `EMBODY=2` and the ten click coordinates from `tasks/evidence/T-0125/matrix.json` (the same clicks as T-0126). The capture waits until the globe has input, drops with G, waits until the glide is under 650 m, embodies, and waits until the mode is `game` before the landed frames. Every site logged `INPAGE drop` with the camera on the click, then reached `mode: game` before `landed-01.png`. On the boreal site the glide went 2100 m, 1844 m, 1323 m, 1063 m, 654 m, 603 m, then embodied at 400 m.

Click coordinates are the ten seam sites. Landed coordinates, cover, and the census are `borealLanding` at the stood point. `frameMs` in `matrix.json` is one `requestAnimationFrame` in the landed page under SwiftShader. It is a software-rendering number. It is not a hardware frame time.

## Hardware graphics

**UNVERIFIED.** No real GPU was available (`nvidia-smi` absent, `/dev/dri` absent). The WebGL renderer on every site is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. The JS heap in `matrix.json` (`heap.used`, about 450–530 MB) is the browser heap under that software renderer, not GPU memory. `hardwareFps` and `gpuMemory` on each row are `UNVERIFIED`. Do not read the `frameMs` column as hardware FPS.

## Before and after

T-0126 is the left-hand side (main `05cc328`, through #227). T-0127 is the right-hand side (main `2dc8e20`, through #243). Animals are the ones standing in the cast (at most five). Counts in parentheses are the 5 km census where it changed.

| site | click | landed | biome was | biome now | animals were | animals now | software frame ms was | software frame ms now |
|---|---|---|---|---|---|---|---|---|
| boreal forest | 52, -97 | 52.000, -97.000 | boreal | tundra | hare, deer, black bear, eagle, beaver | same five | 13.8 | 10.5 |
| tundra | 64.5, -119.7 | 64.500, -119.701 | rock | boreal | none | none | 17.3 | 9.3 |
| alpine | 0.5, 54 | 0.500, 54.000 | boreal | boreal | none | none | 12.9 | 7.0 |
| coast | 44.3, -122.2 | 44.300, -122.200 | boreal | rock | hare, deer, fox, eagle, moose | same five | 18.1 | 10.4 |
| desert | 27.4, 27.7 | 27.400, 27.700 | desert | desert | none | red fox (census 23) | 13.7 | 9.0 |
| tropics | -7.1, -67 | -7.100, -67.000 | tropical | tropical | white-tailed deer (census 22) | white-tailed deer (census 22) | 11.7 | 20.7 |
| ocean edge | 36.6, -121.9 | 36.600, -121.900 | prairie | prairie | deer, black bear, fox | same three | 9.3 | 10.1 |
| polar | 74.2, 50.6 | 74.200, 50.599 | tundra | ice | none | red fox, caribou (38), arctic fox (4), gray wolf (1) | 10.7 | 14.9 |
| prairie | 51, -107 | 51.000, -107.000 | prairie | prairie | hare, deer, fox, eagle, beaver | same five | 11.5 | 23.6 |
| wetland (lake) | 47.9, -104.9 | 47.908, -104.913 | prairie | prairie | hare, deer, lynx, beaver, moose | same five | 13.4 | 11.7 |

Landed latitude and longitude stay within 0.001° of the click at nine sites. The wetland point is 0.008° south and 0.013° west of the click, the same offset T-0126 recorded. Lighting at every site is **day** (15 Aug, day 227, clock about 09:06–09:15, sun elevation 26°–49°). `lighting` on each row is the same sun the sky uses at the landed latitude.

Screenshots: `<slug>/landed-01.png` and `<slug>/landed-02.png`. Census, lighting, picture counts, console lines, and the seam note are in each `landing.json` and in `matrix.json`.

## What the frames show

The Holarctic list is in the polar census: woodland caribou 38, arctic fox 4, red fox 5, gray wolf 1. `picture.fulls` is 4 there. Neither polar frame shows a readable body. The desert census, empty in T-0126, is now red fox 23, and `picture.fulls` is 2. A readable fox does not stand clear of the black band. Yukon tundra (64.5, -119.7) is still an empty census.

Where a body clears the black band it is a silhouette: the eagle at the boreal site, one quadruped at the coast and the prairie, the deer at the wetland. The other animals in those casts are in the data and are not readable. The tropics deer is the one animal in the census (`picture.fulls` 2) and both frames are a solid black mass with no readable deer on the skyline. Canada lynx is in the wetland five. It still has no Meshy file, so the procedural body is what the picture keeps.

A pixel count on `landed-02.png` (the band from 35% to 72% of the height, luminance under 12) is near-black on this share of the band: boreal 72%, tundra 60%, alpine 27%, coast 64%, desert 48%, tropics 65%, ocean 41%, polar 60%, prairie 59%, wetland 22%. The sky above that band is lit.

## Seams and lighting

No site shows a tile crack or a height step in the landed frame. The ground in the black band could hide a low seam. Every site still has the unlit black foreground from T-0126: the ground and the near animals are silhouettes against a day sky, sun 26°–49° up, `lighting.state` `day`. Wetland and alpine show the most ground detail (grass, or open sky with a black band). The boreal, coast, polar, and tropics frames are the hardest to read. That silhouette is the landed-ground look. It was not changed here.

## Console

Every site logged two lines: `Failed to load resource: the server responded with a status of 404 (Not Found)` (the message does not name a URL) and `THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported` (SwiftShader). The wetland page also logged the `PROBE cap=Minimum` line (SwiftShader, bench about 1015 ms). Page errors: none. Exit code 0 at all ten sites. The boreal and prairie casts still report six full meshes.

## For @Grokbot-1

Cover, the population list, the tree stand, and the unlit ground belong on your side. `inpage.ts` and `sky.ts` were left alone. Frames are `tasks/evidence/T-0127/<slug>/landed-02.png` unless noted.

1. **Boreal forest** 52, -97. Cover reads **tundra** (was boreal) at 218 m with vegetation 0.93. The census is still the boreal set, and the frame is a closed conifer stand. `boreal/landed-02.png`.
2. **Tundra** 64.5, -119.7. Cover reads **boreal** (was rock) at 376 m with vegetation 0.71. The census is empty, so there is no caribou. The frame is cattails, broad leaves, and conifers. `tundra/landed-02.png`.
3. **Alpine** 0.5, 54. Cover stays **boreal** at 2166 m. The census is empty. The frame is open sky and one shrub. `alpine/landed-02.png`.
4. **Coast** 44.3, -122.2. Cover reads **rock** (was boreal) at 1039 m with vegetation 0.91. The census is the forest set (hare 4754, deer, moose, lynx, black bear, grizzly 1, eagle, beaver, fox) and still has no caribou. The frame is a closed stand. `coast/landed-02.png`.
5. **Desert** 27.4, 27.7. Cover stays **desert**, vegetation 0. The census is now red fox 23. Conifer and leafy silhouettes are still on the skyline. `desert/landed-02.png`.
6. **Tropics** -7.1, -67. Cover stays **tropical**. The deer (census 22) is not readable: both frames are a solid black mass. `tropics/landed-01.png` and `tropics/landed-02.png`.
7. **Ocean edge** 36.6, -121.9. The stand is dry **prairie** at 31 m. The census has deer, black bear, and fox. The frame is grass and spruce. `ocean/landed-02.png`.
8. **Polar** 74.2, 50.6. Cover reads **ice** (was tundra) at 110 m with vegetation 0.83. The census is the Holarctic set (caribou 38, arctic fox 4, red fox 5, wolf 1) and `picture.fulls` is 4. The frame is a closed conifer stand, and no animal body is readable. `polar/landed-01.png` and `polar/landed-02.png`.
9. **Prairie** 51, -107. Cover stays **prairie** at 588 m, vegetation 0.42. The population list is still the boreal set (hare 1209, lynx 7, caribou 1, wolf 1, grizzly 1, plus deer, moose, bear, eagle, beaver, fox). The skyline is a spruce stand. `prairie/landed-02.png`.
10. **Wetland** 47.9, -104.9. The point is dry **prairie** at 749 m, so the near-shore census does not run (`shore: false`). The five in the frame data are hare, deer, lynx, beaver, and moose. The picture is spruce and grass on dry ground, with the deer the readable silhouette. `wetland/landed-02.png`.
11. **All ten sites.** Day lighting, and the foreground is an unlit black band, so animals read as skyline silhouettes or not at all. Same symptom in every `landed-02.png`.

Coast 44.3, -122.2 still has no caribou in the census. That hole is holding. Grizzly count is 1 and stays outside the five-animal cap (the five shown are hare, deer, fox, eagle, moose).

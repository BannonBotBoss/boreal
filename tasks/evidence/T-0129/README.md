# T-0129 ten-site in-page descent, recaptured

Sprint #192, 3 Nov 2026. grokbot-3. Base is main `afecd46` (3 Nov 2026). That commit is #260. The tree includes #247 (GI probe NaN fix for the black landed ground), #248 (a land landing in a sea grid cell keeps the zonal tree line), #249 (tree thinning on desert, ice, rock, and tundra landings), and #250 through #260 (layered clouds). `world/globe/inpage.ts`, `render/sky.ts`, the Rust simulation, the landed-ground lighting, and the cloud code were not edited. Animal models were left as they are. Canada lynx still has no Meshy file; the procedural body stays the fallback.

SwiftShader (software GL), Chrome headless, 1280×720. `tools/landing-matrix.mjs` calling `tools/fall-shot.mjs` with `EMBODY=2` and the ten click coordinates from `tasks/evidence/T-0125/matrix.json` (the same clicks as T-0126 and T-0127). The capture waits until the globe has input, drops with G, waits until the glide is under 650 m, embodies, and waits until the mode is `game` before the landed frames. Every site logged `INPAGE drop` with the camera on the click, then reached `mode: game` before `landed-01.png`. The glide entered the band at 2100 m and the saved low frame is the first sample under 800 m (758–799 m). The wait then continued until the HUD height was under 650 m, and the embody frames are at 400 m.

Two extra frames per site, `glide-2100.png` and `glide-650.png`, record that descent. The HUD height of each one is in `matrix.json` under `glide`.

Click coordinates are the ten seam sites. Landed coordinates, cover, and the census are `borealLanding` at the stood point. `frameMs` in `matrix.json` is one `requestAnimationFrame` in the landed page under SwiftShader. It is a software-rendering number. It is not a hardware frame time.

## Hardware graphics

**UNVERIFIED.** No real GPU was available (`nvidia-smi` absent, `/dev/dri` absent). The WebGL renderer on every site is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. The JS heap in `matrix.json` (`heap.used`) is the browser heap under that software renderer, not GPU memory. `hardwareFps` and `gpuMemory` on each row are `UNVERIFIED`. Do not read the `frameMs` column as hardware FPS. Software `frameMs` on this pass is 10.2–15.9 ms.

## Before and after

T-0127 is the left-hand side (main `2dc8e20`, through #243). T-0129 is the right-hand side (main `afecd46`, through #260). The near-black share is the same cut as T-0127: on `landed-02.png`, the band from 35% to 72% of the height, full width, Rec. 709 luminance (0–255) under 12. Re-running that cut on the committed T-0127 frames reproduces the published 22–72% shares within one point. Animals in the last column are the ones that can be told apart in the landed frames. The player wolf stands in every frame and is not part of the census. Counts in parentheses are the 5 km census.

| site | near-black was | near-black now | ground and plants | cover against the picture | census against what is visible | coordinate error |
|---|---|---|---|---|---|---|
| boreal forest | 72% | 2.0% | lit grass and conifers | boreal, and the picture is a conifer stand with grass | hare, deer, bear, eagle, beaver; all five readable | 0.0004° |
| tundra | 60% | 12.8% | lit ground, conifers, and broad leaves | boreal (unchanged); the picture is a closed mixed stand, not open tundra | empty; no animal | 0.0008° |
| alpine | 27% | 0.0% | lit grass and one shrub | boreal (unchanged) at 2166 m; the picture is open grass, not closed forest | empty; no animal | 0.0003° |
| coast | 64% | 17.2% | lit ground and conifers | boreal (was rock); the picture is a closed conifer stand | hare, deer, fox, eagle, moose; deer and eagle readable | 0.0003° |
| desert | 48% | 0.3% | lit green grass; trees still on the skyline | desert, vegetation 0; the picture is green grass and trees | red fox (23); a sliver at the left edge of `landed-01`, not a readable body | 0.0003° |
| tropics | 65% | 11.6% | lit ground and dark trees, not a black mass | tropical; the picture is dark conifers and a rock | white-tailed deer (22); not readable in either frame | 0.0003° |
| ocean edge | 41% | 14.7% | lit grass and spruce | prairie (unchanged) at 31 m; the picture is spruce, not the sea | deer, black bear, fox; the bear is readable | 0.0000° |
| polar | 60% | 19.0% | lit grass and conifers | tundra (was ice); the picture is a closed conifer stand | caribou (38), arctic fox (4), red fox (5), wolf (1); caribou and a white canid readable | 0.0009° |
| prairie | 59% | 18.8% | lit grass and spruce | prairie; the picture is a spruce stand | hare, deer, fox, eagle, beaver; hare, deer, and eagle readable | 0.0004° |
| wetland (lake) | 22% | 10.8% | lit grass, dry | prairie (unchanged) at 749 m; the picture is dry grass and trees, not a lake | hare, deer, lynx, beaver, moose; deer, beaver, and moose readable | 0.0125° |

The coordinate error is the larger of `|landed latitude − click latitude|` and `|landed longitude − click longitude|`. Nine sites stay within 0.001°. The wetland point is 0.0078° north and 0.0125° west of the click, the same offset T-0127 recorded. Lighting at every site is **day** (15 Aug, day 227, clock about 09:04–09:14, sun elevation 26°–49°). `lighting` on each row is the same sun the sky uses at the landed latitude.

Screenshots: `<slug>/landed-01.png`, `<slug>/landed-02.png`, `<slug>/glide-2100.png`, `<slug>/glide-650.png`. Census, lighting, picture counts, console lines, and the seam note are in each `landing.json` and in `matrix.json`.

## What the frames show

The black unlit foreground from T-0126 and T-0127 is gone. The lower-middle band that was 22–72% near-black is now 0.0–19.0%. Where the census names animals and they stand clear of the grass, the bodies are readable: the boreal five, the coast deer and eagle, the ocean bear, the polar caribou and a white canid, the prairie hare, deer, and eagle, and the wetland deer, beaver, and moose. The remaining near-black is dark trunks, not an unlit ground.

The tropics deer is still the one animal in the census (`picture.fulls` 2) and is not readable in either frame. The desert fox (`picture.fulls` 2, census 23) is a yellow sliver at the left edge of `desert/landed-01.png`, not a body you can read in the scene. Yukon tundra (64.5, -119.7) is still an empty census. Canada lynx is in the wetland five. It still has no Meshy file, and it is not a body you can pick out of that frame.

Cover moved at three sites. Manitoba (52, -97) now reads **boreal** (was tundra) and the picture is a conifer stand. The coast (44.3, -122.2) now reads **boreal** (was rock) and the picture is a closed conifer stand. The polar site (74.2, 50.6) now reads **tundra** (was ice). The polar picture is still a closed conifer stand.

## Clouds

The new clouds (#250–#260) are on these frames only as far as this nadir descent shows them. There is no black cloud base across a sky, and no shader error in the console.

The high frame is the first band sample, HUD height 2100 m, while the patch fade is still 0. The low frame is the first sample under 800 m (758 m at the prairie site through 799 m at the wetland). The camera looks down.

- At 2100 m the picture is the globe ground: green land, or a dark map where the click is on a coast (ocean, wetland). Boreal, tundra, and coast have a flat grey corner. Wetland `glide-2100.png` also has blocky green tiles over that dark map.
- At about 760–800 m most sites are a flat green field. Ocean `glide-650.png` is blocky translucent green polygons. Wetland `glide-650.png` is a blurred warm field with soft bands. Neither is a readable cloud deck, and neither has a black base.
- Landed skies are flat grey, or clear blue at the tropics. Alpine `landed-02.png` has a soft white cloud texture. No landed sky shows banding or a black cloud base, except the wetland pair.

Both wetland landed frames have a flat black region in the upper right. On `wetland/landed-02.png` the near-black pixels (luminance under 8) in that corner run about from x 890 to 1277 and y 2 to 318. The same region is black in `wetland/landed-01.png`. The other nine sites do not have that wedge. The console did not log a shader error for it.

## Seams and lighting

No site shows a tile crack or a height step in the landed ground. The ground and the plants are readable at all ten sites, in daylight, sun 26°–49° up, `lighting.state` `day`. That is the change from T-0127.

## Console

Every site logged two lines: `Failed to load resource: the server responded with a status of 404 (Not Found)` (the message does not name a URL) and `THREE.WebGLRenderer: KHR_parallel_shader_compile extension not supported` (SwiftShader). Every site also logged `PROBE cap=Minimum` (SwiftShader). Page errors: none. Exit code 0 at all ten sites. No shader compile error, and no NaN line.

## For @Grokbot-1

Cover, the population list, the tree stand, and the cloud volumes belong on your side. `inpage.ts`, `sky.ts`, the lighting, and the cloud code were left alone. Frames are `tasks/evidence/T-0129/<slug>/landed-02.png` unless noted.

1. **Boreal forest** 52, -97. Cover now reads **boreal** (was tundra) at 218 m with vegetation 0.93. The census is the same boreal set, and the five in the frame are readable. `boreal/landed-02.png`.
2. **Tundra** 64.5, -119.7. Cover still reads **boreal** at 376 m with vegetation 0.71. The census is still empty, so there is no caribou. The frame is a closed mixed stand: conifers, broad leaves, and flowers. `tundra/landed-02.png`.
3. **Alpine** 0.5, 54. Cover stays **boreal** at 2166 m. The census is empty. The frame is open grass and one shrub. `alpine/landed-02.png`.
4. **Coast** 44.3, -122.2. Cover now reads **boreal** (was rock) at 1039 m with vegetation 0.90. The census is the forest set and still has no caribou. The frame is a closed stand. Deer and eagle are readable. `coast/landed-02.png`.
5. **Desert** 27.4, 27.7. Cover stays **desert**, vegetation 0. The census is red fox 23. Conifer and broadleaf trees are still on the skyline, and the ground is green grass. The fox is not a readable body. `desert/landed-02.png` and `desert/landed-01.png`.
6. **Tropics** -7.1, -67. Cover stays **tropical**. The ground and the trees are lit. The deer (census 22) is not readable in either frame. `tropics/landed-01.png` and `tropics/landed-02.png`.
7. **Ocean edge** 36.6, -121.9. The stand is dry **prairie** at 31 m. The census has deer, black bear, and fox. The bear is readable. The frame is grass and spruce, not the sea. `ocean/landed-02.png`.
8. **Polar** 74.2, 50.6. Cover now reads **tundra** (was ice) at 110 m with vegetation 0.83. The census is the Holarctic set (caribou 38, arctic fox 4, red fox 5, wolf 1) and `picture.fulls` is 4. Caribou and a white canid are readable. The picture is still a closed conifer stand. `polar/landed-02.png`.
9. **Prairie** 51, -107. Cover stays **prairie** at 588 m, vegetation 0.42. The population list is still the boreal set (hare 1209, lynx 7, caribou 1, wolf 1, grizzly 1, plus deer, moose, bear, eagle, beaver, fox). Hare, deer, and eagle are readable. The skyline is a spruce stand. `prairie/landed-02.png`.
10. **Wetland** 47.9, -104.9. The point is dry **prairie** at 749 m, so the near-shore census does not run (`shore: false`). The five in the frame data are hare, deer, lynx, beaver, and moose. Deer, beaver, and moose are readable. The ground is dry grass and spruce. Both landed frames have a flat black region in the upper right. `wetland/landed-02.png`.
11. **Clouds on the way down.** The 2100 m and ~760–800 m frames are nadir views. They do not show a cloud deck, a black cloud base, or a shader error. Wetland `glide-2100.png` has blocky green tiles. Wetland `glide-650.png` is a blurred warm field with soft bands. Ocean `glide-650.png` is blocky translucent green polygons.

Coast 44.3, -122.2 still has no caribou in the census. That hole is holding. Grizzly count is 1 and stays outside the five-animal cap (the five shown are hare, deer, fox, eagle, moose).

# T-0130 landing wildlife, recaptured

Sprint #192, 3 Nov 2026. grokbot-3. Base is main `5c0075d`. The viewer places the census cast. `world/globe/inpage.ts`, `render/sky.ts`, the Rust simulation, the census, the cover classification, the landed-ground lighting, and the cloud code were not edited. Animal models were left as they are. Canada lynx still has no Meshy file; the procedural body stays the fallback.

SwiftShader (software GL), Chrome headless, 1280×720. `tools/landing-matrix.mjs` calling `tools/fall-shot.mjs` with `EMBODY=2` and the ten click coordinates from `tasks/evidence/T-0125/matrix.json` (the same clicks as T-0126, T-0127, and T-0129). The capture waits until the globe has input, drops with G, waits until the glide is under 650 m, embodies, and waits until the mode is `game` before the landed frames. Every site logged `INPAGE drop` with the camera on the click, then reached `mode: game` before `landed-01.png`. The embody frames are at 400 m.

Click coordinates are the ten seam sites. Landed coordinates, cover, and the census are `borealLanding` at the stood point. `frameMs` in `matrix.json` is one `requestAnimationFrame` in the landed page under SwiftShader. It is a software-rendering number. It is not a hardware frame time.

## Hardware graphics

**UNVERIFIED.** No real GPU was available (`nvidia-smi` absent, `/dev/dri` absent). The WebGL renderer on every site is `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. The JS heap in `matrix.json` (`heap.used`) is the browser heap under that software renderer, not GPU memory. `hardwareFps` and `gpuMemory` on each row are `UNVERIFIED`. Do not read the `frameMs` column as hardware FPS. Software `frameMs` on this pass is 6.6–35.6 ms.

## What was checked, and what changed

T-0129 left the tropics deer unseen and the desert fox as a sliver. The picture counts already included those meshes (`fulls` 2, wolf plus one census animal), so the list was being drawn. The causes, checked against `placeLandingAnimals` and the T-0129 coordinates:

| cause | what the frames and the placer showed |
|---|---|
| Outside the view, or behind the wolf | A lone species was slot 0, 5.2 m to the side at 5 m ahead. That puts the body on the frame edge. Putting the same animal on the aim hides it behind the embodied wolf. |
| Hidden by plants | Tropics vegetation is 0.999. The desert fox, once centred, stood behind a bush on the sight line. |
| Too far | The old dry search could walk out toward 40 m. These two animals were already inside the full-mesh distance. The new place prefers about 7 m ahead, which stays inside the 16 m full mesh. |
| Facing away | The cast was already broadside (`yaw + π/2`). That is unchanged. |
| Wrong scale | The tropics deer is the same Meshy deer that reads at boreal. The fox is the same Meshy fox. Scale was not changed. |
| Below the ground | Feet were already set to `heightAt`. That snap stays. A missing height becomes 0 rather than NaN. |

The cast now stands about 7 m ahead, inside the follow camera's frame (3.6 m behind the wolf, 48° vertical, 16:9). A lone animal is about 2 m to the right of the aim, beside the wolf. A trunk or a standing rock is skipped for a nearby open cell. Grass, flowers, and the nearest stems drop on a disc at the feet and along the corridor from the camera to the animal.

## Before and after

T-0129 is the left-hand side (main `afecd46`). T-0130 is the right-hand side. "Readable" means the body can be told apart in the landed frames. The player wolf stands in every frame and is not part of the census. The five drawn animals are a cap, not the whole census.

| site | census | readable before (T-0129) | readable after (T-0130) |
|---|---|---|---|
| boreal forest | hare, deer, moose, lynx, wolf, caribou, black bear, eagle, beaver, fox | hare, deer, black bear, eagle, beaver | hare, deer, black bear, eagle, beaver |
| tundra | empty | none | none |
| alpine | empty | none | none |
| coast | hare, deer, moose, lynx, black bear, grizzly, eagle, beaver, fox | deer, eagle | hare, deer, eagle, moose |
| desert | red fox (23) | a sliver at the left edge, not a body | the fox, to the right of the wolf, in both frames |
| tropics | white-tailed deer (22) | not readable | the deer, to the right of the wolf, in both frames |
| ocean edge | deer, black bear, fox | the bear | the deer. The fox is partly beside the wolf. The bear is mostly behind the wolf |
| polar | caribou (38), arctic fox (4), red fox (5), wolf (1) | caribou and a white canid | caribou, a white canid, and a smaller yellow fox |
| prairie | hare, deer, moose, lynx, wolf, caribou, black bear, grizzly, eagle, beaver, fox | hare, deer, eagle | hare, deer, eagle, beaver |
| wetland (lake) | hare, deer, moose, lynx, caribou, black bear, beaver, fox | deer, beaver, moose | hare, deer, beaver, moose. The procedural lynx is in the cast and is not a body that can be picked out |

Screenshots: `<slug>/landed-01.png`, `<slug>/landed-02.png`. Census, picture counts, console lines, and the wildlife note are in each `landing.json` and in `matrix.json`.

## For @Grokbot-1

The census and the cover class were left alone. Where the census is empty, no animal was added.

1. **Tundra** 64.5, -119.7. The census is still empty, so there is no caribou. The frame is still a closed stand. `tundra/landed-01.png`.
2. **Alpine** 0.5, 54. The census is still empty. The frame is open grass and one shrub. `alpine/landed-01.png`.
3. **Desert** 27.4, 27.7. The census is still red fox 23, and that fox now reads. Trees are still on the skyline and the ground is still green grass. `desert/landed-01.png`.
4. **Ocean edge** 36.6, -121.9. The stand is still dry prairie and spruce, not the sea. The deer reads. `ocean/landed-01.png`.
5. **Wetland** 47.9, -104.9. The point is still dry prairie, not a lake. Hare, deer, beaver, and moose read. `wetland/landed-01.png`.
6. **Polar** 74.2, 50.6. The census is the Holarctic set. The picture is still a conifer stand. Caribou and a white canid read. `polar/landed-01.png`.

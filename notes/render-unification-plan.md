# One picture from space to the forest floor

Pinned at `e7b9ab7` (main, 2026-10-25 17:13 PT). Line numbers are from that commit. `src/world/globe/inpage.ts` and `src/world/globe/globeView.ts` are being edited on `grokbot-3/globe-enter-fix` (not on origin at this pin). The single time control is `grokbot-3/single-time-control` (also not on origin). This plan does not edit those files or the clock.

## Plain-English summary

From space and from the forest, the game draws two different pictures.
Coming down, it fades between them, and the ground, the clouds, and the colours jump.
This plan makes one picture the whole way down.
High up you see the planet. Snow, forest colour, clouds, trees, grass, and water appear only when you are close enough to see them.
The extra sky, the extra clouds, and the fade between the two pictures go away.
Trees, grass, rivers, animals, and photos stay. They turn on by how high you are.
Day and night, and the setting that simplifies the picture when the computer struggles, stay the same.
Should the flight down be one smooth picture? Yes or no.
Far away, should forest be a colour on the land until trees are big enough to see (A), or simpler trees all the way up (B)?
Should this land as several small changes you can try one at a time (A), or one big change (B)?

## What this document is

An audit of every drawing path, why they are separate, and a plan to make them one. No drawing code changes in this task. The first code step is listed at the end and is not done.

Matthew, 2026-10-25 18:25 PT: "I am not satisfied with the implementation of the rendering system. Why are all these systems isolated? Everything should have been using the same set of pipelines. One system for rendering. Based on the distance, resolution is automatically scaled to show just the layers that produce a realistic view from that point." He also said never reinvent: reuse what is already here. 18:26 PT: plans must open with a short plain summary, because he has been approving plans without being able to read them.

Board task: `tasks/T-0078-render-unification.md`. This plan waits for another agent's approve-plan before any of the phases below are built.

## Decisions (the same three, with the consequence)

1. **One smooth picture the whole way down?** Yes means later phases remove the fade between the space picture and the forest picture. No means we stop after writing down the ranges, and the fade stays.
2. **Far forest.** (A) The land keeps today's painted forest colour until a tree would be big enough to see, then the existing trees appear. (B) The existing simpler tree shapes are used from much higher up. A reuses the paint and the trees. B reuses the trees and draws many more of them.
3. **How it lands.** (A) Several small changes, each with a test and a picture check, which is what the phases below are. (B) One large change. A is the default in this plan because a large swap of both pictures at once is how the current jump was created.

This plan adds no new distances. Every height and size below is already in the code. A later phase that needs a new number has to cite a source or mark it as game calibration before it is used (project rule 5, board rule 12).

## Why they are separate

The forest picture came first. The planet picture was added later as its own page, then a fade was built so the two pages could meet. Each new look (clouds, snow, trees, grass, water, night sky) was added to whichever page was being worked on that day. They share the quality ladder and the world clock. They do not share one picture.

| When | What landed | Evidence |
|---|---|---|
| 2026-10-15 `56506c5` | Forest view already had its own picture, sky, and draw loop | `src/render/buildScene.ts`, `src/render/sky.ts` exist in that snapshot |
| 2026-10-15 `458c750` | Forest lighting, shadows, and the quality ladder | `src/render/photoreal.ts`, `src/core/quality.ts` |
| 2026-10-18 `988e564` | Planet view as its own page, own picture, own loop | `src/world/globe/globeView.ts` header lines 12–13; `startGlobe` line 86 |
| 2026-10-18 `e390e72` | Shared drawing surface for the fade, plus a second picture behind the forest | `src/world/globe/farLayer.ts` lines 1–6; `src/world/globe/logDepth.ts` lines 1–6 explain why the planet could not share depth with the forest |
| 2026-10-18 `39954d7` | The fade between the two pictures (`?transition=inpage`) | `src/world/globe/inpage.ts` lines 1–10; `src/world/globe/transition.ts` lines 1–11 |
| 2026-10-18 `0ce9ada` | Planet air and clouds, separate from the forest sky | `src/world/globe/atmosphere.ts` |
| 2026-10-18 `505995c`, `e8e95dc`, `67bcb9e` | River water, grass, and a second tree drawer, each on the forest picture | `src/render/water.ts`, `src/render/grass/grass.ts`, `src/render/trees/game.ts` |
| PR #33, T-0034 | Bare load opens the planet; the fade is the way down | `src/world/globe/startView.ts` lines 8–9; merged `grok-globe/globe-default-view` |
| PR #35, T-0041 | Cloud deck and landing polish on the fade, not a merge of the two pictures | `src/world/globe/transition.ts` lines 31–40 |
| 2026-10-23 `32e3c12` | Planet layer switches (clouds, sunlight, air, aurora, snow, plants, ocean, field lines, plates, Venus, airglow) | `src/world/globe/layerPanel.ts` lines 7–11 |
| 2026-10-23 `f8358cd` | Venus drawn in the forest sky, while the switch lives on the planet panel | `src/render/venusSky.ts`, `src/render/sky.ts` line 70 |
| PR #48 T-0057, PR #88 T-0058, PR #59 T-0073, PR #45 T-0056 | Sunlight, snow and ice, local clouds, and the cloud opening, each added on the planet picture | `src/world/globe/tile.ts` solar uniforms, `src/world/globe/hydroLayer.ts`, `src/world/globe/localClouds.ts`, `src/world/globe/transition.ts` `CLOUD_OPEN` |
| T-0068 | One photo wrap around whichever picture is on screen | `src/camera/gameCamera.ts` lines 1–8, mounted from the forest and from `globeView.ts` line 92 and from the sun page |

`docs/research/hardware-scaled-rendering.md` (2026-10-24) already said to extend the quality ladder. It also suggested a second drawing technology later. This plan does not add that. Project rule 2 is one implementation each. A second technology would be another isolated picture.

## What the split costs

- **Two pictures on the way down.** In the middle band the planet is drawn into a half-size image, then the forest is drawn on top (`src/world/globe/inpage.ts` lines 5–7 and 274–280; `src/world/globe/farLayer.ts` lines 1–6 and 10–14). The forest depth is cleared, so the two never share a surface (`farLayer.ts` lines 3–4).
- **A jump in colour that later code tries to hide.** The forest floor reads about twice as dark and green as the planet around it, so the planet land is tinted on the way down (`inpage.ts` lines 47–49). Lake colours and water roughness are eased toward the forest water (`inpage.ts` line 46, `lakeRough: .32`). The forest is blended toward the planet pixel behind it (`inpage.ts` lines 55–58; `src/render/fade.ts` lines 22–28). The forest fog washed distant tree tops out (`inpage.ts` line 284). Ambient occlusion drew a dark square over the far image, so it stays off until the forest is fully in (`inpage.ts` lines 51–52).
- **Two skies and three clouds.** Planet air is a ray-marched shell (`atmosphere.ts` lines 1–10, dome at line 211). Forest air is a different sky plus a linear fog (`sky.ts` lines 15–16, 68–74, 132–149). Planet clouds are a shell at 2.5 km with 900 km cells (`atmosphere.ts` `CLOUDS`, line 45) that opens between 1,500 km and 150 km (`transition.ts` lines 39–40). Local clouds are a 32 km box (`localClouds.ts` lines 1–8 and 15). Forest clouds are a 550 m dome (`sky.ts` line 74). The forest sky is hidden for the whole band (`inpage.ts` lines 9–10).
- **Two waters, two snows, two forests.** Planet ocean is a colour mix on the land mesh (`tile.ts` lines 122–124 and 216–221) with Cox and Munk roughness (`tile.ts` lines 125–128 and 239). Forest water is a shared flowing sheet (`water.ts` lines 1–4; chunk sheet `buildScene.ts` lines 118–120; rivers from `src/core/stages/rivers.ts`). Planet snow, ice, and plant cover are textures (`planetLayers.ts` lines 12–16; `hydroLayer.ts` lines 1–5 and 27). Forest snow is a per-vertex mix on the ground shader (`src/render/pbr.ts` lines 3–8 and 45–46). Planet plants are a colour (`src/world/globe/planet.ts` `vegetationWeight` line 203). Forest trees are meshes only near the player.
- **Two loops and two viewpoints.** The forest frame is `src/main.ts` line 372, and it calls the fade or the forest draw at line 490. The standalone planet page runs its own loop (`globeView.ts` lines 525 and 545). The forest camera clips at 0.2 m to 700 m (`buildScene.ts` line 83). The planet camera clips from the altitude out past the horizon (`globeView.ts` line 441). The band overwrites the forest camera and puts the old clip back afterwards (`inpage.ts` lines 237–269).
- **Detail is decided in many places.** The quality ladder (`src/core/quality.ts` lines 28–34) scales several of them, which is the one shared knob (project rule 10). The distances themselves still live apart: planet quadtree (`src/world/globe/lod.ts` lines 6–18), interest radii (`src/core/interest.ts` lines 10–19), chunk size 40 m (`src/core/world.ts` line 18), terrain segments 80 or a coarse eighth (`src/core/renderSettings.ts` line 17; `buildScene.ts` line 116), tree ranges (`buildScene.ts` lines 132–145), second tree drawer inside 28 m (`src/render/trees/game.ts` lines 5–8 and 18), grass inside 48 m (`src/render/grass/cover.ts` lines 73–74), flowers inside about 45 m (`src/render/flora/flora.ts` lines 14–15 and 39). A feature-size gate already exists for planet snow, ice, and soil (`src/world/globe/visibility.ts` lines 1–31; `planetLayers.ts` lines 68–73) and is not used by the forest layers.

## Inventory

"Loop" is who calls the draw. "Falloff" is how detail changes with distance. Tools at the bottom are separate pages. They are not the flight from space to the forest.

### Forest picture (the game)

| Path | Renderer, scene, camera, loop | Falloff | Shading and data |
|---|---|---|---|
| Forest frame | One `WebGLRenderer` `buildScene.ts:71`. One `Scene` with linear fog `:78`. One `PerspectiveCamera` 48°, near 0.2, far 700 `:83`. `draw` `:265` calls `post.render` `:366`. `main.ts:372` `frame` calls it at `:490` unless the planet page has the screen. | Quality ladder `quality.ts:28`. Interest near 60 m / mid 100 m, and the ladder replaces those radii (`interest.ts:10`, `quality.ts:29`). | Height, water, and soil from `core/world.ts` and `core/stages`. Clock from `core/worldClock.ts` via `main.ts:471`. |
| Lighting and post | Same renderer and camera. `createPhotoreal` `photoreal.ts:71` adds cascaded shadows `:107`, image-based light `:261`, and the governor. `createPost` `post.ts:109` builds one composer `:115` (scene pass, god rays, ambient occlusion, lens blur, bloom, grade). If those are off it draws the scene directly `:141`. | Shadow cascades, occlusion, rays, and resolution are ladder columns (`quality.ts:21` and `:28`). God rays and occlusion are eased off in the band (`buildScene.ts:364`, `inpage.ts:51`). | Sun direction from `sky.ts`. Exposure from `core/light.ts` via `post.ts:111`. |
| Sky, fog, Venus | Same scene. `createSky` `sky.ts:68`. Preetham sky `:15`. Cloud dome, sphere radius 550 `:74`. Fog distances rewritten from Koschmieder visibility `:132` and `:146–149`. Venus points `:70` and `:151`, implemented in `venusSky.ts:21`. | Cloud cover and fog from the weather cell under the viewer (`sky.ts:127–136`). Hidden for the whole band (`inpage.ts:9–10`). | `core/timeOfDay.ts` sun, `core/weather.ts`, `core/planets.ts` `venusAt`. |
| Ground chunks | Same scene. `createChunk` `buildScene.ts:112`. Near chunks use `terrainSegments` (80); mid chunks use a coarse eighth `:116`. Water sheet segments 32 or 8. Mesh built in `terrainCore.ts:71` and `render/math.ts` `chunkTerrainJob` `:49`. | Interest tier. Beyond mid, no mesh (rule 8). | `heightAt`, lakes, rivers (`terrainCore.ts:2` and `:94`). |
| Water and rivers | One material `water.ts:23`, used by the chunk plane `buildScene.ts:118` and the lake or river sheet `:120`. | The sheet exists only on loaded chunks. Flow is a per-vertex attribute. | `core/stages/rivers.ts` and `riverPlanform.ts`. Optics comments in `water.ts:1–4`. |
| Trees, first drawer | `treeGeometry` `trees.ts:217`, three details, shared geometry `:122`. Placed as batched levels or a `LOD` (`buildScene.ts:132–145`). Wind and leaf uniforms `trees.ts:46–48` and `:212`. | Ranges 0 / 55 / 115 m times the tree lod scale (`buildScene.ts:132`). Bark crossfades by distance (`trees.ts:109`). | Species from `core/treeSpecies.ts` and the stand map (`trees.ts:33–42`). |
| Trees, second drawer | `?trees=v2`, default start includes it (`startView.ts:8`). `trees/game.ts:18` near under 28 m, mid out to the far ring, crowns beyond. `updateTrees` `:79`, called from `flora/fartrees.ts:19`. | Three batched meshes, one per band (`game.ts:5–8`). Only black spruce (`:18`). Other species stay on the first drawer. | Same stand placement. Weber–Penn build in `trees/conifer.ts`. |
| Far trees | `createFarTrees` `flora/fartrees.ts:26`. One batched mesh of the first drawer's far shape, or the second drawer's crowns. | Ring follows the ladder lod and mid radius (`fartrees.ts:6–8`). No trunks you can touch. | `core/flora/stands.ts` Thomas clusters. |
| Far-ring helper and impostors | `trees/farRing.ts:15` and `trees/impostor.ts`. Used by the tree viewer, not by the forest frame. | Crowns inside a split distance, impostors past it (`farRing.ts:14–20`). | Caller supplies positions. |
| Grass | `createGrass` `grass/grass.ts:158`, updated from `buildScene.ts:345`. Three blade meshes, 6 / 3 / 1 segments (`cover.ts:74`). | Full density to 9 m, lod distances 6 and 14 m, gone by 48 m, and never past the interest near radius (`grass.ts:164`, `cover.ts:73–76`). | `cover.ts` `coverAt` from slope, wetness, lakes, rivers. |
| Flowers, moss, far plants | `createFlora` `flora/flora.ts:19` (header). One batched mesh, two details, carpets. Moss via `flora/moss.ts`. | Near clumps 6 m, full 12 m, lod at 9 m (`flora.ts:39`). Radius shrinks with the foliage column (`:14`). | `core/flora/plants.ts` and `core/flora/site.ts`. |
| Animals | Wolf `playables.ts` and `playerWolf.ts:91`. Hare `animals/hare.ts` from `buildScene.ts:103`. Deer rig `animalRig.ts:5`, added at `buildScene.ts:129`. People and pushed rocks use a live `LOD` (`buildScene.ts:142–145`). | Deer hidden past `animalDistance` (`buildScene.ts:225`, setting at `renderSettings.ts:52`). No far animal meshes (rule 8). | Species specs, brains, `core/sim`. Drawn in the forest scene. |
| Rocks, logs, props, surface bands | `generateGeometry` into the chunk batch (`buildScene.ts:135–138`). Bands `bands.ts:1–8` on batched solids only. | Rock ranges 0 / 10 / 24 m (`buildScene.ts:132`). | `core/rocks.ts`, `core/world.ts` entities. |
| Ground look | `terrainMaterial` `pbr.ts:32`. Wet and snow from vertex attributes `:45–46`. Cloud shadow and leaf translucency `:76` and `:59`. | Chunk resolution as above. | `core/ground.ts` wet and snow. |
| Target outline | Own scene, same renderer and camera (`targetGlow.ts:34–35`). Drawn after the frame (`buildScene.ts:367`). Not in the post composer (`targetGlow.ts:4–7`). | Nothing while there is no target. | The highlighted entity's mesh. T-0035. |
| Photos and gallery | `capture` `buildScene.ts:418` reuses `post.render` `:415`. Gallery `photo/gallery.ts:40` asks that capture to draw again (`photoMode.ts:116`). The viewfinder wraps `renderer.render` (`gameCamera.ts:46–58`) and adds a one-quad scene for filters `:39–41`. | Same frame as the forest or the planet, whichever is mounted. | `photo/store.ts`, `photo/frame.ts` crop math. T-0068. |

### Planet picture

| Path | Renderer, scene, camera, loop | Falloff | Shading and data |
|---|---|---|---|
| Standalone planet page | `entry.ts:4` loads `startGlobe` `globeView.ts:86`, which creates a second `WebGLRenderer` `:91`, a second `Scene` `:131`, a second camera near 1 far 1e9 `:125`, and its own loop `:525`. | `globeLod` `lod.ts:24` from the same ladder. Tile rows `lod.ts:12–17` (16–48 segments, levels up to 15–19). | `planet.ts` `sampleSurface`. |
| Shared planet (the flight) | `createGlobe` `globeView.ts:106` with `shared: true` borrows the forest renderer (`inpage.ts:89` and `:115`). Ownership flags `globeView.ts:66–68` and `:79`: no second resize, no disposing the renderer, no second clock load, no second governor feed. | Same quadtree. Near the ground, tiles under the camera split deeper (`globeView.ts:51` and `:451–454`). | Same planet function. Home region reads the forest height (`planet.ts` local height, `handoff.ts:5–6`). |
| Land, ocean, lakes, plants, snow | One tile material `tile.ts` `globeMaterial` `:187`. Ocean versus land `:216–221`. Lake colours `:129`. Detail noise fades from 5 km to 2.5 km (`tile.ts:140`). Snow, ice, soil `planetLayers.ts:78`. Hydrosphere and plant cover `hydroLayer.ts:27–37`, sampled in `planetLayers.ts:85–90`. | Quadtree level. Snow, ice, and soil also fade by how many pixels the feature spans (`planetLayers.ts:68–73`, `visibility.ts:29`). Hydro texture is on or off with the cloud-octave row, not with distance (`hydroLayer.ts:18–21`). | `core/planetBudget.ts`, `core/planet/hydrosphereBudget.ts`, `core/planet/surfaceBudget.ts`. |
| Air, clouds, aurora, airglow | `createAtmosphere` `atmosphere.ts:173`, dome `:211`, added `globeView.ts:143–166`. `setLayers` `:221` is the clouds, air, and airglow switches. `setAurora` `:219`. | Ray steps per ladder row `atmosphere.ts:42`. Cloud octaves per row `:45`. Cloud cover opens with altitude `transition.ts:40`. | `composition.ts`, `core/geodynamo.ts` `auroraFromSolarWind`, world clock `globeView.ts:483`. |
| Local clouds | `createLocalClouds` `localClouds.ts`, added `globeView.ts:150`. Own shader `:39–40`. | Shown below 40 km (`localClouds.ts:15`). 32 km box. | `core/atmo/cloudColumn.ts`. |
| Field lines | Lines in the planet scene `globeView.ts:189–196`. Off unless asked (`layerPanel.ts:11`). | Planet-fixed, drawn over the tiles (`renderOrder` 2). | `core/geodynamo.ts` `fieldLineR` `:27`. |
| Plates | Line group `globeView.ts:176–178`. Off unless asked. | Built on first show. | `plates.ts` `buildPlates` `:27`, MORVEL rates `:12`. |
| Cutaway, axis, parcels | `createAxis` `axisView.ts:19` adds a group to the same planet scene `:23`. Disc shader `:34`. Parcel points from `parcels.ts:24`. | On when `?r=` or `?dir=` is set (`axisView.ts:20`). | Wasm interior and gas profiles (`axisView.ts:10`). |
| Layer switches | `layerPanel.ts:7` lists clouds, sunlight, atmosphere, aurora, snowIce, vegetation, ocean, fieldLines, plates, venus, airglow. Applied in `globeView.ts:443`. | Deep-time existence `core/layerExistence.ts:39` can turn a layer off before it formed. | User hide list, plus the physical state. |
| Sun light on the planet | One directional light and one hemisphere in the planet scene `globeView.ts:139` and `:443–444`. Intensity 3.2 when sunlight is on. | Not the forest cascaded shadows. | `sunNow()` from the world clock. |
| The fade (band and patch) | Forest renderer. Planet draws into `farLayer.ts:12`. Forest scene background becomes that image (`inpage.ts:280`). Forest camera is flown by `inpage.ts:238`. Mode machine `transition.ts:26` and `:94`: game, band, globe. | Patch fades from 2 km to 600 m (`transition.ts:18–21`, `handoff.ts:14`). Handover at 60 m. Undithered parts (sky, animals, grass, flowers, props, rocks) stay hidden until the patch is in (`inpage.ts:8–10`). | `fade.ts` uniforms. Landing search `handoff.ts:26`. |
| Page choice | `entry.ts:4–6`. `?view=globe` standalone planet. `?view=farlayer` the proof page. `?tree=1` the tree viewer. Otherwise the forest, which may enter the planet through `inpage.ts`. | — | `startView.ts:9`. |

### Other pictures (not the flight down)

| Path | Renderer, scene, camera, loop | Why it stays out |
|---|---|---|
| Sun page | Own renderer, ortho camera, composer `src/world/sun/sunView.ts:52–61`. Own loop `:104`. Viewfinder mount. | A disc close-up for T-0067. It should keep calling the shared photo wrap. It is not the planet or the forest. |
| Locomotion lab | Own renderer `:42`, scene `:46`, camera `:58`, loop `:175`. | Dev page `tools/locomotion-lab.html`. |
| Tree viewer | Own renderer `trees/viewer.ts:23`, own scene, own loop `:107`. | Dev page `?tree=1` (`entry.ts:6`). |
| Gamepad model | Own renderer `ui/pad3d.ts:18`, scene and camera `:20`. Drawn when the pad panel updates `:76`. | A UI model, not the world. |
| Far-layer proof | Own renderer `farLayerDemo.ts:23`, own scene `:32`, own loop `:50`. | Dev page `?view=farlayer` (`entry.ts:5`). |

## One picture

Reuse the forest drawing surface, the forest frame loop, the planet's distance tree, and the feature-size gate. Do not add a new drawing surface, a new loop, or a new distance system.

### One drawing surface, one picture, one viewpoint, one loop

- **Surface.** The forest `WebGLRenderer` (`buildScene.ts:71`). The shared planet already borrows it (`globeView.ts:66–68`). The standalone page's second surface (`globeView.ts:91`) goes away once `?view=globe` is a mode of the same loop. The sun page, the lab, the tree viewer, and the pad model keep their own surfaces because they are not this flight.
- **Picture.** One scene. Planet tiles, the air shell, local clouds, field lines, and plates become groups in the forest scene, moved with the existing camera-relative offset (`src/world/globe/origin.ts`). The half-size background image (`farLayer.ts`) goes away once both live in that scene. Per-material log depth stays (`logDepth.ts:1–6`): turning on renderer-wide log depth would rebuild every forest program. That comment is why the fade used a second depth buffer. The merge keeps the per-material path and extends it only to materials that need the long view.
- **Viewpoint.** The forest camera (`buildScene.ts:83`). The band already overwrites its position and clip planes (`inpage.ts:238–269`). Orbit uses that same camera, with near and far set from altitude the way `globeView.ts:441` already does. There is no second camera to blend at 60 m.
- **Loop.** `main.ts` `frame` (`:372`) on the one world clock. `inpage.frame` (`:220`) already is that slot for the fade. The standalone `requestAnimationFrame` (`globeView.ts:525`) becomes a call into the same step. The clock files stay with `grokbot-3/single-time-control`. This plan does not add a clock and does not edit one.

### Distance decides the layers

`visibility.ts` already answers "how close is close enough" for snow, ice, lakes, forest colour, rivers, and soil: a layer fades in when its real size covers about two pixels, and never finer than eye acuity (`visibility.ts:8–31`). `layerPanel.ts` already names the layers. `layerExistence.ts` already turns a layer off when it has not formed.

The missing piece is that forest trees, grass, water, the forest sky, and the planet shell do not consult that gate. Phase 4 makes them.

Each layer keeps the range it already has. The table is a copy, not a new design.

| Layer | Contributes when | Falls off by | Already implemented as |
|---|---|---|---|
| Planet land and ocean colour | Whole flight | Quadtree split `lod.ts` | Tile mesh |
| Snow, ice, wet soil | `visibleWeight` | Pixel size `visibility.ts` | `planetLayers.ts:70` |
| Painted forest | `visibleWeight` of `forest` (about 1 km) | Same gate | Hydro texture alpha `hydroLayer.ts:37`, until real trees replace it |
| Cloud shell | Above the local-cloud box | Octave row, and `CLOUD_OPEN` | `atmosphere.ts` |
| Local clouds | Below 40 km | 32 km box | `localClouds.ts:15` |
| Forest sky dome and linear fog | Only until the air shell covers the ground | Then removed | `sky.ts` |
| Air, aurora, airglow | The shell is the one air | Step counts per ladder row | `atmosphere.ts:42` and `:221` |
| Terrain mesh | Inside interest mid, as the finest quadtree leaf | 80 segments near, coarse mid | `buildScene.ts:116` |
| Rivers and lakes | Same leaf | Sheet segments 32 / 8 | `water.ts` |
| Trees | Inside the far-tree ring; full shape inside 28 m for black spruce | v2 bands, else the first drawer's 0 / 55 / 115 m | `trees/game.ts`, `trees.ts` |
| Grass and flowers | Inside 48 m and 45 m | Blade and plant lod | `cover.ts`, `flora.ts` |
| Animals | Inside the animal draw distance | Full rig, or hidden | `buildScene.ts:225` |
| Field lines and plates | Only if the player asks | Unchanged | Off by default `layerPanel.ts:11` |
| Venus | One point, the forest implementation | Magnitude and extinction | `venusSky.ts`, parented to the one scene so it is visible from space too |

Quality stays one ladder (`quality.ts`). A layer may not add its own quality switch (project rule 10). Interest stays the budget for creating meshes (`interest.ts`, rule 8). Far land stays a pure function of the seed (`planet.ts`, `core/stages`), which is what the tiles already sample.

### Where each system goes

| System | | Why |
|---|---|---|
| Forest renderer, forest frame loop, quality ladder, interest jobs | Keep | They are already the single surface, the single loop, and the single cost control |
| Planet quadtree (`cube.ts`, `lod.ts`) | Keep | It is the distance tree from orbit. The chunk becomes its finest leaf |
| Feature-size gate and layer list | Keep and extend | `visibility.ts`, `layerPanel.ts`, `layerExistence.ts` |
| Planet air shell | Keep | The one air. Forest sky retires after the colour match passes |
| Forest water material, trees, grass, flowers, animal rigs, ground shader | Keep | Near layers. They turn on through the gate |
| Photo wrap and gallery | Keep | Already one wrap around `renderer.render` |
| Per-material log depth, camera-relative origin | Keep | They are how one scene can span orbit and the ground |
| Shared planet on the forest renderer | Merge | Into the one scene and the one camera |
| Fade, far image, patch dither | Remove after the leaf merge | They exist to hide two surfaces |
| Standalone planet renderer and loop | Remove after the loop merge | `startGlobe` becomes a mode flag |
| Forest cloud dome and linear fog | Remove after the air match | Same job as the shell and Koschmieder term already in `sky.ts:132` |
| Second tree drawer | Keep beside the first | It only covers black spruce. Removing the first drawer would drop the other species. New species are rows, not a third drawer (rule 2) |
| Sun page, lab, tree viewer, pad model, far-layer proof | Leave | Not the flight. Proof page goes when the far image goes |
| Particle planets (T-0070) | Leave for later | If that plan is approved, the finest leaf becomes the particle surface. This plan does not start that |

## Phases

Each phase is a later pull request. None of them is in this one. Each one runs `npm test` and `npx tsc --noEmit`, keeps the governor's 60 fps target (`src/config/systemProperties.ts` line 173), and keeps instantiation inside the 4 ms job budget (`interest.ts` line 13). A phase that draws the planet twice in one frame fails its budget. Anything the player can see also needs the frame gate (board rule 6): a recording, sampled frames, and a calibrated comparison. This plan itself is documents only, so it uses the evidence gate (rule 12) and has no frame gate.

Files this plan and the early phases leave alone: `src/world/globe/inpage.ts`, `src/world/globe/globeView.ts`, the globe-to-ground camera flight (`inpage.ts` `camera` and `descend`, `transition.ts` `globePitch`), and the clock files owned by `grokbot-3/single-time-control` (`src/core/worldClock.ts`, `src/core/timeOfDay.ts`, `src/core/timescale.ts`, `src/ui/chronometer.ts`, `src/render/shaderClock.ts`).

### 1. Copy the ranges into one table

The obvious small step. Not done here.

Add one module that lists the rows in the distance table above, each value read from the constant that already holds it. A test fails if the copy drifts. Nothing in the draw loop reads the table yet, so the picture does not change. No new distance. Does not touch the files in the paragraph above.

Tests: the equality test only. Perf: no draw change. Frame gate: not applicable.

### 2. One viewpoint above the band

Wait until `grokbot-3/globe-enter-fix` has merged, because this moves the flight in `inpage.ts` and `globeView.ts`.

The forest camera is the planet camera from orbit down, not only inside the band. Two scenes remain. The 60 m blend of two cameras (`transition.ts` `blendSec`) becomes a no-op because there is one camera.

Tests: at 2 km the camera position matches the old band pose within a centimetre. Frame gate: stills at orbit, 2 km, 600 m, and 60 m. Perf: the sum of planet milliseconds and forest milliseconds stays at or under today's band (`inpage.ts` `STATS` already records both).

### 3. One loop

Wait until `grokbot-3/single-time-control` has merged, then call the clock it leaves behind. Do not edit those files in parallel with that branch.

`?view=globe` uses `main.ts` `frame`. `globeView.ts` `tick` no longer schedules itself. The sun page is unchanged.

Tests: one hour on the planet page equals one hour in the forest for the same clock. Frame gate: the sun direction matches `timeOfDay.ts` at a known hour. Perf: no second loop.

### 4. Layers consult the feature-size gate

Wire the existing draws to `visibleWeight`, using the sizes already in `visibility.ts` and the distances already in the layer table. Extend `FEATURE_SIZE_M` only with a size that already has a citation in the file it comes from.

Tests: at the published range, the weight matches `visibleWeight`. Orbit weight for grass and for animal rigs is 0. Ground weight for grass inside 48 m stays 1. Frame gate: orbit shows no grass and no tree meshes; the forest shows both. Perf: hiding a layer must not add a draw.

### 5. One air

Crossfade the forest sky and the linear fog out as the planet shell's aerial term reaches the ground. Delete the dome and the linear fog only after the frames match. Venus moves with the one scene in this phase so it is visible from space and from the ground.

Tests: a clear-sky colour at the ground and at 2 km, compared with a calibrated capture of today's forest sky at the same hour. Perf: one sky draw. Frame gate: horizon and cloud deck at those two heights.

### 6. The finest planet leaf is the forest chunk

The quadtree leaf inside the playable region, once it is chunk-sized, is `createChunk` instead of a second terrain mesh. The patch dither (`fade.ts`) and the land tint (`inpage.ts` `landTint`) become unused because there is one surface.

This is the phase that removes the jump. It waits for phases 2 and 4.

Tests: a leaf at the player is the chunk id the forest already builds. Frame gate: mean colour across the old 2 km line and the old 600 m line, scored by the same capture script used for T-0058, with that script's known-match and known-mismatch calibration named in the handoff. Perf: one terrain draw for that leaf, not a tile plus a chunk.

### 7. Remove the leftovers

Delete the far image, the standalone planet renderer and loop, the forest cloud dome, and the patch fade. Only after phases 5 and 6 have passed their frame gates. The far-layer proof page goes with the far image.

Tests: `entry.ts` no longer starts a second world renderer for `?view=globe`. Frame gate: the same three heights as phase 6, plus a photo taken from orbit and from the ground through the one viewfinder. Perf: the band no longer records a separate planet pass.

## Risks

- **Log depth.** Renderer-wide log depth rebuilds every forest program and breaks the occlusion and god-ray passes (`logDepth.ts:1–6`). The merge keeps per-material log depth. Phase 6 has to show the occlusion pass still reads a depth it understands.
- **Two branches in the same files.** Phases 2 and 3 wait. Editing `inpage.ts`, `globeView.ts`, or the clock in parallel will collide.
- **Shader hitches.** The governor already waits before it changes world knobs because a tier change rebuilds chunks (`quality.ts` lines 51–58). A phase that recompiles the tile shader and the chunk shader in one frame will miss the 60 fps target. Build them the way tiles already build, as sliced jobs (`interest.ts`).
- **Memory during the crossfade.** Phases 5 and 6 may hold two representations for one flight. They drop the old one in the same pull request that passes the frame gate, not in a later cleanup that can be skipped.
- **T-0070.** A particle surface is a different source for the finest leaf. Starting it inside these phases would invent a second terrain. The leaf stays the heightfield chunk until that plan is approved on its own.
- **Black spruce only.** Turning off the first tree drawer because the second exists would remove birch, pine, aspen, and fir. The plan keeps both drawers until those species are rows in the second one.
- **Tools.** Folding the sun page, the lab, or the tree viewer into the world scene would make their dev loops depend on the flight. They stay separate.

## Spot-check

A reviewer can open three rows of the inventory at `e7b9ab7` and see the renderer, the scene, and the loop described. The handoff `tasks/handoffs/T-0078-grokbot-3.md` lists the findings and what each one became.

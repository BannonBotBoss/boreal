# One picture from space to the forest floor

Pinned at `e7b9ab7` (main, 2026-10-25 17:13 PT). Line numbers in the inventory are from that commit. `src/world/globe/inpage.ts` and `src/world/globe/globeView.ts` are being edited on `grokbot-3/globe-enter-fix` (not on origin at this pin). The single time control is `grokbot-3/single-time-control` (also not on origin). This pull request does not edit those files or the clock.

## Plain-English summary

From space and from the forest, the game draws two different pictures.
Coming down, it fades between them, and the ground, the clouds, and the colours jump.
This plan makes one picture the whole way down.
What you see depends on how far away you are and on how fast time is moving.
Far away, or when time runs fast, a forest is a colour and a density on the land. Trees appear as you come close and as time slows down.
From space you see weather, the season, and how thick the plants are. Near a kilometre you see habitats. Near a hundred metres you see animals and trees. On the ground you see grass, tracks, and scents.
The change from one of these to the next is gradual, so nothing pops or flickers.
The extra sky, the extra clouds, and the fade between the two pictures go away.
An old way of drawing is replaced when keeping it would break this one picture.
Day and night stay. The picture still gets simpler when the computer struggles.
The flight down is one smooth picture. The work lands as several small steps, and each step can be tried on its own.

## What this document is

An audit of every drawing path, why they are separate, and a plan to make them one. No drawing code changes in this task. The first code step is listed at the end and is not done.

Matthew, 2026-10-25 18:25 PT: "I am not satisfied with the implementation of the rendering system. Why are all these systems isolated? Everything should have been using the same set of pipelines. One system for rendering. Based on the distance, resolution is automatically scaled to show just the layers that produce a realistic view from that point." He also said never reinvent: reuse what is already here. 18:26 PT: plans must open with a short plain summary, because he has been approving plans without being able to read them.

Matthew, 2026-10-25 7:15 PM PT: he gives permission to rewrite anything, as long as his design issues #100–#109 are addressed (especially #107). Where keeping an existing render path would compromise the single space-and-time observation pipeline, this plan replaces that path rather than patching it. The 18:25 PT reuse line still covers a path that already serves that one pipeline.

Board task: `tasks/T-0078-render-unification.md`. This plan waits for another agent's approve-plan before any of the phases below are built.

## Answers

Matthew answered the three open questions in issues #107 ("very important"), #108 ("time dial"), and #109 ("details"), opened 2026-10-26 02:10–02:13 UTC. His latest issues win over older issues, over this plan's older distance-only wording, and over the code where they disagree. #109 is newer than #108, which is newer than #107.

1. **The flight down is one smooth picture.** Yes. Later phases remove the fade between the space picture and the forest picture. #107's design statement is seamless travel from one animal in real time to planetary and evolutionary scales. Writing the ranges down is the first step, and the fade does not stay.
2. **Far forest is a colour and a density on the land.** Trees appear as you get close. #107: the renderer moves from showing objects to showing patterns as distance and time scale increase. Orbital scale shows weather systems, seasonality, and vegetation density. About 1 km shows habitats. About 100 m shows animals and trees. Ground level shows grass, tracks, and scents. The full stations are in the band table below.
3. **The work lands as several small steps, each one testable.** That is the phase list. One swap of both pictures at once is how the current jump was created.

Issue numbers below are the source for every rate and station that is not already a constant in the code. A later phase that needs a number the issues do not give has to cite a source or mark it as game calibration before it is used (project rule 5, board rule 12). This plan does not fill those gaps. #109 names a Geological level and a Biome level and does not give their enter rates. #109's spring uses stiffness and damping and does not give their values. Those stay unset.

Where the issues disagree with each other, the newer one is the table:

- Layer choice is height and time rate together. #107 calls this combined space-time detail. #109 sets the score as spatial score times temporal score. A distance-only gate is the older plan, and it loses.
- Time bands and the overlap between them are #109's. #107's sketch that animal detail turns off above 10×, and #108's hard cuts (immediate only up to 10×, then a new scale with no overlap), are the older sketches.
- What each height shows is #107's list. #109 does not replace that list. #108's space-and-time matrix is an illustration; a cell in it loses where its rate disagrees with #109.

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

The simulation stays at full fidelity. Observation decides what the picture shows. #107 states the principle: the simulation contains a continuous reality, and observation determines representation. The observer's place is space, time, and embodied species together. #109 writes the render score as spatial score times temporal score.

Reuse the forest drawing surface, the forest frame loop, the planet's distance tree, and the feature-size gate as the spatial measurement. Do not add a second picture, a second loop, or a second clock. A path that can only decide by distance, or that exists to hide a second picture, is replaced. Matthew's 7:15 PM PT permission is the authority for that replacement. Issues #100–#109 are the design that replacement has to serve, and #107 is the one the pipeline is built around.

### One drawing surface, one picture, one viewpoint, one loop

- **Surface.** The forest `WebGLRenderer` (`buildScene.ts:71`). The shared planet already borrows it (`globeView.ts:66–68`). The standalone page's second surface (`globeView.ts:91`) goes away once `?view=globe` is a mode of the same loop. The sun page, the lab, the tree viewer, and the pad model keep their own surfaces because they are not this flight.
- **Picture.** One scene. Planet tiles, the air shell, local clouds, field lines, and plates become groups in the forest scene, moved with the existing camera-relative offset (`src/world/globe/origin.ts`). The half-size background image (`farLayer.ts`) goes away once both live in that scene. Per-material log depth stays (`logDepth.ts:1–6`): turning on renderer-wide log depth would rebuild every forest program. That comment is why the fade used a second depth buffer. The merge keeps the per-material path and extends it only to materials that need the long view.
- **Viewpoint.** The forest camera (`buildScene.ts:83`). The band already overwrites its position and clip planes (`inpage.ts:238–269`). Orbit uses that same camera, with near and far set from altitude the way `globeView.ts:441` already does. There is no second camera to blend at 60 m.
- **Loop.** `main.ts` `frame` (`:372`) on the one world clock. `inpage.frame` (`:220`) already is that slot for the fade. The standalone `requestAnimationFrame` (`globeView.ts:525`) becomes a call into the same step. The clock files stay with `grokbot-3/single-time-control`. This plan does not add a clock and does not edit one.

### Height and the time dial choose the layers

`visibility.ts` answers the spatial half for snow, ice, lakes, forest colour, rivers, and soil: a feature fades in when its real size covers about two pixels, and never finer than eye acuity (`visibility.ts:8–31`). That weight is the spatial score. It stays. It is not the whole decision. Forest trees, grass, water, the forest sky, and the planet shell do not consult it today, and nothing in the draw consults the time dial.

#107's stations say what is meaningful at each height. They are stations on a continuous score, blended into their neighbours, so a camera sitting on a boundary does not pop. #107's sketch of a hard animal-detail wall from 0 m to 500 m and from 0.1× to 10× is the older sketch. The time half of that sketch loses to #109. The height list itself is the one #109 does not replace.

| Station (#107) | What the picture shows there |
|---|---|
| Ground | Grass, insects, tracks, scents. At real time, also fur, footprints, wind, and breathing. Around 100×, movement trails and behaviour, and not every footstep |
| 100 m | Animals, trees, streams |
| 1 km | Habitats, territories, migration routes |
| 100 km | Biomes, watersheds, population density |
| Continental | Climate zones, species ranges, ocean currents |
| Orbital | Weather systems, seasonality, vegetation density. #107's view from space also names clouds, storms, aurora, wildfire smoke, night lights, and ocean currents. At lunar distance: continents, ice caps, and weather systems |

The same station changes when time runs faster. #107's combined examples, read with #109's rates where a number disagrees:

| Place and rate | Picture |
|---|---|
| Ground, real time | Fur, footprints, wind, breathing |
| Ground, about 100× | Movement trails and behaviour |
| Orbit, real time | Clouds, storms, day and night. Individual animals are not in the picture |
| Orbit, about 1,000× | Migration flows, seasonal vegetation, ocean bloom |
| Orbit, about 100,000× | Biome expansion, glacial cycles |

#109's time levels are the temporal score. Neighbouring levels overlap on purpose. The overlap is where the blend lives.

| Level (#109) | Rate | What it shows |
|---|---|---|
| Individual | 0.1× to 50× | Animals, footsteps, behaviour |
| Group | 20× to 500× | Herds, packs, flocks |
| Population | 100× to 10,000× | Population density, territories, migration |
| Ecosystem | 1,000× to 1,000,000× | Food webs, predator and prey, forest succession |
| Biome | named in #109's list, no rate given | Left unset |
| Evolution | from 100,000× | Genetic divergence, extinction, speciation |
| Geological | named in #109's list, no rate given | #109 also names a geology simulation mode here. The enter rate stays unset |

#109's continuity rule: nothing disappears because time or height changed. It transforms into the representation for the current observation. Wolf, then pack, then population, then species distribution, then canid lineage. Tree, then stand, then forest biome, then vegetation belt, then plant evolutionary branch. The painted forest colour is the far and the fast end of the tree chain (vegetation density, decision 2). The tree meshes are the near and the slow end. Both are on together across the blend. One of them popping off is the failure #109 names.

#107 also names importance and observability as inputs, and does not give formulas. The resolver accepts them. Until a later cited rule exists, a layer that passed the spatial and temporal scores stays eligible. Species is the third coordinate (#107). With no creature embodied, that term leaves the space-and-time picture unchanged. The species phase below is the one that filters it.

Quality stays one ladder (`quality.ts`). A layer may not add its own quality switch (project rule 10). The ladder is how the computer keeps up. It is not which phenomenon is real at this height and this rate. Interest stays the budget for creating meshes (`interest.ts`, rule 8). Far land stays a pure function of the seed (`planet.ts`, `core/stages`), which is what the tiles already sample.

### The time dial feeds the choice

#108: the time dial is an observation instrument. It says how fast reality advances, how much detail is simulated, how much is drawn, and which phenomena are visible. #109: the dial is a physical control. Input becomes a target rate, the rate eases toward that target, and only then does the picture change level.

The picture reads one observation each frame:

- height, from the one camera
- the dial's current rate, its target rate, and its level (#108's dial, #109's time state)
- the embodied creature, when there is one (#107)

The level the picture uses is #109's, chosen from the current rate with the bands and the blend above. #108's names (immediate, behavioral, ecological, and the rest) are the older cuts. The dial can still carry a name. That name is the #109 level the rate has settled on, so the wheel and the picture cannot disagree.

What exists today is not that dial. The chronometer (`src/ui/chronometer.ts`) scrubs the hour. `src/core/timescale.ts` is a slow-motion multiplier from the address bar, 0.05 to 1. `WEATHER.timeScale` speeds the weather's own steps. Teaching any of those to also pick layers would keep a playback knob in the role #108 gives the dial, and would compromise the pipeline. Layer choice replaces that role. The clock files remain the source of simulation time. This pull request does not edit them. Phases that change how time advances wait until `grokbot-3/single-time-control` has merged. The hook is a read: rate and level in, layer weights out. There is no second clock.

#109 gives the shape of the wheel, cited here and not coded in this pull request. Dial position runs from −1 (fastest rewind) through 0 (paused) to +1 (fastest forward). Inside a hundredth of the centre the target rate is 0. Otherwise the target rate is the sign of the position, times ten raised to the power of (twelve times the absolute position). The rate eases with the spring #109 writes: acceleration is the gap to the target times stiffness, minus damping times the current rate, and the rate then steps by acceleration times the frame time. Stiffness and damping are not in the issue, so they stay unset. #108's stored history (ask for a moment in time, rather than replay every frame) is how a high rate stays cheap. #109's mode switch is the same idea: individual creatures, then populations, then species, then geology. The picture's job is the matching representation. The simulation's job is the matching mode. This plan does not build the geology mode.

### Hysteresis and blend

#109: a level that flips every time the rate crosses one number will flicker. A level turns on above an enter rate and turns off only below a lower exit rate. The cited pair, for behaviour giving way to migration, is enter at 1,200× and exit at 800×. Across that gap the blend is the smooth step #109 writes from 800 to 1,200, so at 900× the migration picture is arriving and the individual animals are still there, and at 1,200× the individuals have finished leaving. The same shape applies at the other overlaps in the #109 table (group already on at 20× while individual still runs to 50×, and so on). A phase that needs a pair the issue does not give has to cite it or mark it as game calibration.

The quality governor already holds a tier so a boundary does not chatter (`quality.ts` lines 51–58, cooldown and the hold before a step back up). That pattern is the one to copy. The governor's millisecond holds are not the dial's rates, and observation does not become another column of the quality ladder.

Height uses the same idea through the continuous spatial score, so a station is not a hard wall. `visibleWeight` already fades by pixel coverage. Altitude hysteresis in metres is not given in #107–#109, so a phase does not invent a metre gap. It uses the pixel fade that already exists, times the temporal blend.

### Issues #100–#106 inside this pipeline

Each of these is in force. Where one of them disagrees with #107–#109, the newer issue wins. None of them adds a second picture.

- **#100 Climate chain.** Sun, then climate, then season, then weather, then local habitat, then what an animal does. The picture shows the link that matches the station: orbital weather, season, and vegetation density; about 1 km, habitats; on the ground, the conditions the animal meets. The renderer does not compute a second climate. Existing weather, water, and plant fields feed the pattern layers. A draw that the resolver cannot weight is replaced.
- **#101 The picture asks what to draw.** The simulation keeps every animal. The picture shows colours, routes, and density from far away, and individuals, tracks, and behaviour from close in. These phases do not add a Rust runtime or a second drawing technology (rule 2, and answer 3). A later task can move the simulation across a boundary. It feeds this picture.
- **#102 and #103 Embodiment.** The player enters a creature that already exists, and that creature's senses are the world it gets. That creature is the species term on the observation. These phases store the term. Until the species phase, an observer with no creature sees the space-and-time picture. There is no second world for the wolf.
- **#104, #105, and #106 Perception is what gets drawn.** When a creature is embodied, the same scene shows what that creature can perceive (scent volumes, heard events, the weight of instinct), which is #107's species term made visible. #106's packed buffer is the shape of that handoff if a boundary exists. It is not built here. The senses halo (`src/render/sensesHalo.ts`) is a beacon overlay. It is not scent lying in the forest. The species phase replaces that overlay with volumes in the one scene, because keeping a beacon overlay as the wolf's nose would break #104.

### Where each system goes

| System | | Why |
|---|---|---|
| Forest renderer, forest frame loop, interest jobs | Keep | The one surface, the one loop, and the one mesh budget |
| Quality ladder | Keep, as cost only | Frame rate. Folding observation into it would mix two jobs and break rule 10 |
| Planet quadtree (`cube.ts`, `lod.ts`) | Keep | It subdivides the land. It does not decide what the land means. The chunk becomes its finest leaf |
| Feature-size gate (`visibility.ts`) | Keep as the spatial score | Pixel size is the spatial half. Using it as the whole decision would ignore the time dial |
| Layer list and deep-time existence | Keep | `layerPanel.ts`, `layerExistence.ts`. A layer that has not formed stays off before the resolver runs |
| Planet air shell | Keep | The one air. The forest sky is replaced after the colour match passes |
| Painted forest and vegetation weight | Keep as the pattern | Decision 2 and the orbital and 1 km stations. This is the far, fast end of the tree chain |
| Forest water, tree meshes, grass, flowers, animal rigs, ground shader | Keep as the near, slow representation | They are the individual end of the chain. The resolver blends them out as height or rate leaves that end. Their old metre cutoffs stop being the decision |
| Distance-only cutoffs (tree 0 / 55 / 115 m, grass 48 m, the animal draw distance) as the thing that decides visibility | Replace | They cannot see the time dial. Keeping them as the decision would leave a second, distance-only pipeline |
| Photo wrap and gallery | Keep | Already one wrap around `renderer.render` |
| Per-material log depth, camera-relative origin | Keep | How one scene spans orbit and the ground |
| Shared planet on the forest renderer | Merge | Into the one scene and the one camera |
| Fade, far image, patch dither, land tint | Replace (remove) after the leaf merge | They exist to hide two pictures. Patching the fade cannot be answer 1 |
| Slow-motion multiplier and the weather time scale, as layer choice | Replace that role | The dial's rate and level are what the resolver reads. The clock still owns simulation time |
| Standalone planet renderer and loop | Replace (remove) after the loop merge | `startGlobe` becomes a mode flag |
| Forest cloud dome and linear fog | Replace (remove) after the air match | Same job as the shell and the Koschmieder term already in `sky.ts:132` |
| Senses halo, as the creature's perception | Replace in the species phase | #104. Beacons are not scent volumes. Until that phase the halo stays, and it is not asked to be the pipeline |
| Second tree drawer | Keep beside the first | It only covers black spruce. Removing the first drawer would drop the other species. New species are rows, not a third drawer (rule 2) |
| Sun page, lab, tree viewer, pad model, far-layer proof | Leave | Not the flight. Proof page goes when the far image goes |
| A Rust runtime, a second drawing technology, a species-only scene | Do not add | #101 and #104 are satisfied inside this picture. A second picture is the isolation Matthew rejected |
| Particle planets (T-0070) | Leave for later | If that plan is approved, the finest leaf becomes the particle surface. This plan does not start that |

## Phases

Each phase is a later pull request. None of them is in this one. Each one runs `npm test` and `npx tsc --noEmit`, keeps the governor's 60 fps target (`src/config/systemProperties.ts` line 173), and keeps instantiation inside the 4 ms job budget (`interest.ts` line 13). A phase that draws the planet twice in one frame fails its budget. Anything the player can see also needs the frame gate (board rule 6): a recording, sampled frames, and a calibrated comparison. This plan itself is documents only, so it uses the evidence gate (rule 12) and has no frame gate.

Files this plan and the early phases leave alone: `src/world/globe/inpage.ts`, `src/world/globe/globeView.ts`, the globe-to-ground camera flight (`inpage.ts` `camera` and `descend`, `transition.ts` `globePitch`), and the clock files owned by `grokbot-3/single-time-control` (`src/core/worldClock.ts`, `src/core/timeOfDay.ts`, `src/core/timescale.ts`, `src/ui/chronometer.ts`, `src/render/shaderClock.ts`). Replacement of a path in those files waits until the branch that owns them has merged. Permission to rewrite is not permission to collide.

### 1. Write the observation table

The obvious small step. Not done here.

Add one module that lists the stations, the #109 levels, the two continuity chains, and the cited hysteresis pair (enter 1,200×, exit 800×, blend from 800 to 1,200). A test fails if a row drifts from the issue text. Nothing in the draw loop reads the table yet, so the picture does not change. No stiffness, no damping, no geological enter rate, no invented metre gap. Does not touch the files in the paragraph above.

Tests: the equality test only. Perf: no draw change. Frame gate: not applicable.

### 2. One viewpoint above the band

Wait until `grokbot-3/globe-enter-fix` has merged, because this moves the flight in `inpage.ts` and `globeView.ts`.

The forest camera is the planet camera from orbit down, not only inside the band. Two scenes remain. The 60 m blend of two cameras (`transition.ts` `blendSec`) becomes a no-op because there is one camera.

Tests: at 2 km the camera position matches the old band pose within a centimetre. Frame gate: stills at orbit, 2 km, 600 m, and 60 m. Perf: the sum of planet milliseconds and forest milliseconds stays at or under today's band (`inpage.ts` `STATS` already records both).

### 3. One loop

Wait until `grokbot-3/single-time-control` has merged, then call the clock it leaves behind. Do not edit those files in parallel with that branch.

`?view=globe` uses `main.ts` `frame`. `globeView.ts` `tick` no longer schedules itself. The sun page is unchanged.

Tests: one hour on the planet page equals one hour in the forest for the same clock. Frame gate: the sun direction matches `timeOfDay.ts` at a known hour. Perf: no second loop.

### 4. The resolver, unread by the meshes

A pure function. Height and rate go in. A weight for each station and each #109 level comes out, using the table, the enter/exit pair, and the smooth step from 800 to 1,200. The hook that feeds it returns rate 1 and the individual level until a real dial is connected, so today's picture does not change and no clock file is edited. The draw still ignores the weights.

Tests: a rate that chatters around one threshold does not flip the level on every sample. Between 800× and 1,200× the blend moves and both representations are partly on. At orbital height and 1×, the individual-animal weight is 0. On the ground at 1×, the ground station is on. Perf: no draw change. Frame gate: not applicable.

### 5. Forest colour and trees use the resolver

The first step the player can see. Far away, or when the rate leaves the individual level, the land keeps today's painted forest colour (the pattern). Close and slow, the existing tree meshes blend in across the overlap. The old 0 / 55 / 115 m checks stop being the decision. The drawers still build the mesh. This is answer 2.

Tests: the weights at a published station match phase 4. Frame gate: orbit shows forest colour and no tree meshes; the forest at real time shows the trees; a hold inside the blend shows both, with neither popping. Perf: a hidden mesh is not a draw.

### 6. One air

Crossfade the forest sky and the linear fog out as the planet shell's aerial term reaches the ground. Delete the dome and the linear fog only after the frames match. Venus moves with the one scene in this phase so it is visible from space and from the ground. Weather, season, and the cloud deck are the orbital station, selected by the same resolver.

Tests: a clear-sky colour at the ground and at 2 km, compared with a calibrated capture of today's forest sky at the same hour. Perf: one sky draw. Frame gate: horizon and cloud deck at those two heights, and the same horizon with the resolver held at 1× and at the cited 1,200× enter rate. The dial's wheel does not have to exist for that hold.

### 7. The finest planet leaf is the forest chunk

The quadtree leaf inside the playable region, once it is chunk-sized, is `createChunk` instead of a second terrain mesh. The patch dither (`fade.ts`) and the land tint (`inpage.ts` `landTint`) become unused because there is one surface.

This is the phase that removes the jump. It waits for phases 2 and 5.

Tests: a leaf at the player is the chunk id the forest already builds. Frame gate: mean colour across the old 2 km line and the old 600 m line, scored by the same capture script used for T-0058, with that script's known-match and known-mismatch calibration named in the handoff. Perf: one terrain draw for that leaf, not a tile plus a chunk.

### 8. The other stations, one layer each

Animals, grass, habitats, and weather systems each get their own small change onto the same resolver. Tracks, scents, and insects are the ground station in #107 and are not world layers today (the halo is an overlay). That step adds them in the one scene. It does not stretch the grass radius and call it scent.

Tests: the layer's weight matches the resolver at the station #107 names. Frame gate: one recording per layer, at the station and at the next station, with the resolver at 1× and at a #109 rate where that layer should have become the pattern. Perf: a hidden layer adds no draw.

### 9. Remove the leftovers

Delete the far image, the standalone planet renderer and loop, the forest cloud dome, and the patch fade. Only after phases 6 and 7 have passed their frame gates. The far-layer proof page goes with the far image.

Tests: `entry.ts` no longer starts a second world renderer for `?view=globe`. Frame gate: the same three heights as phase 7, plus a photo taken from orbit and from the ground through the one viewfinder. Perf: the band no longer records a separate planet pass.

### 10. The species term

When a creature is embodied, the same scene filters through that creature's perception (#102–#106). An observer with no creature skips this and sees the space-and-time picture. No second scene. The halo's job as the wolf's nose ends here, replaced by scent in the scene (#104). This waits until phases 4 and 8 have a ground picture to filter.

Tests: the same world positions produce a different weight for a named sense when the embodied creature changes, and the same weight when no creature is embodied. Frame gate: one creature and the observer, same place, same hour, same dial rate. Perf: the filter does not draw the world a second time.

## Risks

- **Log depth.** Renderer-wide log depth rebuilds every forest program and breaks the occlusion and god-ray passes (`logDepth.ts:1–6`). The merge keeps per-material log depth. Phase 7 has to show the occlusion pass still reads a depth it understands.
- **Two branches in the same files.** Phases 2 and 3 wait. Editing `inpage.ts`, `globeView.ts`, or the clock in parallel will collide. The rewrite permission does not lift that wait.
- **A patched seam.** Keeping the fade, the distance-only cutoffs, or the slow-motion multiplier as a second way to choose layers would leave the isolation #107 closes. Those are replacements.
- **Shader hitches.** The governor already waits before it changes world knobs because a tier change rebuilds chunks (`quality.ts` lines 51–58). A phase that recompiles the tile shader and the chunk shader in one frame will miss the 60 fps target. Build them the way tiles already build, as sliced jobs (`interest.ts`).
- **Two representations during a blend.** #109 requires both ends of a chain to be partly on across the overlap. The phase that passes the frame gate drops the one the blend has finished with, in that same pull request.
- **Numbers the issues left blank.** Stiffness, damping, a geological enter rate, a biome enter rate, and a metre gap for altitude hysteresis are not in #107–#109. Coding a guessed value would break rule 5.
- **T-0070.** A particle surface is a different source for the finest leaf. Starting it inside these phases would invent a second terrain. The leaf stays the heightfield chunk until that plan is approved on its own.
- **Black spruce only.** Turning off the first tree drawer because the second exists would remove birch, pine, aspen, and fir. The plan keeps both drawers until those species are rows in the second one.
- **Tools and a second runtime.** Folding the sun page, the lab, or the tree viewer into the world scene would make their dev loops depend on the flight. They stay separate. A Rust runtime or a species-only scene in these phases would be a second picture.

## Spot-check

A reviewer can open three rows of the inventory at `e7b9ab7` and see the renderer, the scene, and the loop described. The stations and the time levels can be checked against issues #107 and #109. The handoff `tasks/handoffs/T-0078-grokbot-3.md` lists the findings and what each one became.

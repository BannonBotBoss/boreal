# What draws each part of the game

Matthew asked whether every visible part is known. This is that list. Three.js draws. The sim (Rust, or the TypeScript stand-in when wasm is not loaded) only supplies numbers: heights, hours, pup homes, sun angles.

A headless Chrome on this machine uses SwiftShader. Its shadow programs often fail to compile (`'shadow` / error 1282). On that GPU a lit wolf can wash out white, and shadows do not darken the ground. Matthew's Windows Edge with a real GPU does the opposite: shadows work, and a night with no fill goes pitch black. The frames from the headless machine are not a picture of his screen.

## Sky

`src/render/sky.ts` `createSky`. A Three.js `Sky` dome (Preetham) plus a cloud hemisphere (`CLOUD_VERT` / `CLOUD_FRAG` in the same file). Fog is a linear `THREE.Fog` whose colour follows the hour. The clear colour starts as `#c4d4c8` in `buildScene`. The sky dome is the upper hemisphere, so anything the terrain does not cover, below that rim, used to be an empty black band. The horizon skirt now fills that gap.

Headless: the sky usually draws. A lost shadow program does not blank the sky.

## Sun and moon

Same file. One `DirectionalLight` for the sun, one for the moon (`0x9fb4e6`), a `HemisphereLight`, and a dim rim light. Intensities come from `src/core/light.ts`:

- Sun colour: Rayleigh plus Ångström aerosol, overhead normalised to white.
- Illuminance: shortwave × 105 lm/W. Full moon at zenith is 0.27 lx. Moonless sky is 0.001 lx.
- Exposure gain is `(1e5 / lux)^0.85`, times wolf night vision (`wolfEyes`).
- Night amount η = 1 − smoothstep(−6°, 4°) on solar elevation.
- The draw keeps a floor: hemisphere at least `1.6 η`, moon key at least `1.05 η`. The daylight IBL scale (0.11) must not multiply that floor away (`sceneFill`).

`src/render/photoreal.ts` copies the sun into the cascaded shadow lights. The moon does not cast shadows (a second cascade would miss 60 fps on Quest 3).

Headless: shadow cascades fail to compile, so the ground is not darkened by the shadow map and a wolf can read as white. On a real GPU the shadows are real, which is why night was black there and only "fine" in headless shots.

## Terrain

`src/render/buildScene.ts` builds chunk meshes from `chunkTerrainJob` (`src/render/math.ts`) and `terrainMaterial` (`src/render/pbr.ts`). Heights are `heightAt` (`src/core/world.ts`). The mesh is `MeshStandardMaterial`, so it takes the sun, the moon, the hemisphere, and the fog.

The horizon skirt is `src/render/horizonMesh.ts` (`createHorizonSkirt`), fed by `planetFor` in `src/world/globe/planet.ts`. It is the ground from the edge of the chunks out to the horizon, one draw, no extra shadow map. It is hidden while the camera near-plane is the drone's (the in-page band has its own skirt).

Headless: the skirt and the chunks draw. Do not trust their shadow darkening.

## Grass

`src/render/grass/grass.ts`. One instanced mesh per blade LOD. A custom vertex shader bends the blades; the fragment uses the standard light, with a small emissive lift (`STYLIZED.grassLift` in `src/render/stylizedPalette.ts`). It receives shadows and does not cast them.

Headless: blades draw. Their lighting is wrong if the shadow program failed.

## Trees

Near trees: `src/render/trees.ts` and, with `?trees=v2`, `src/render/trees/game.ts` plus `src/render/trees/conifer.ts` (bark, needles, far crowns). Far filler: `src/render/flora/fartrees.ts`, placed at `heightAt`, from the stand model. Crowns are `MeshStandardMaterial` (`crownMaterial`), so fog fades them. They are not a second ground. The skirt under them is what stops the far cones reading as shapes stuck to the sky.

Headless: crowns usually draw. Shadowed bark can be the wrong brightness.

## Water

Chunk water sheets in `buildScene` (`waterMaterial` in `src/render/pbr.ts`) and wakes in `src/core/waterWake.ts` drawn from `src/render`. The sheet is a standard material at the water level. It does not cast a shadow.

Headless: the sheet draws. Specular highlights from the sun are unreliable when the shadow shader fails.

## Mama

Two bodies. The playable rig is `src/render/playerWolf.ts` (feet at local y = 0, `MeshStandard` plus fur cards). The close stored wolf is `src/render/meshySkin.ts` `spawnSkin`, driven by `src/render/gaitLod.ts`. The stored mesh is centred on the torso. `footLiftMetres` raises it so the lowest point sits on the terrain the root is already standing on. `src/render/coatFinish.ts` tints the coat. `stylizedNight` in `src/render/stylizedPalette.ts` adds a cool emissive only as the sun drops, so she is not a lamp at noon and not gone at night.

Headless: this is the wash-to-white. A failed shadow program on her standard material ignores the night and blows the coat out. On Edge she should stay grey and moonlit.

## Pups

`src/animals/pups.ts` using `createPlayerWolf({ pup: true })`. Homes are `besideMother` in `src/core/litter.ts` (and `rust/boreal-sim/src/litter.rs`): five uneven spots beside her, not a line. They use the same night fill as mama. Four weeks old is about a third of her size.

Headless: same white-coat risk as mama. A missing pup in a headless frame is not proof they failed to spawn.

## Fox

`src/render/coatFinish.ts` `finishFoxCoat` tints the stored fox and ignores the daylight lamp so the rust survives noon. The body is still a skinned mesh from `meshySkin`, with the same foot lift.

Headless: the fox can look flat or too bright. The rust tint is in the shader, so it usually survives.

## Cosmos sphere

`src/world/cosmos/sphere.ts`, shown by `src/world/cosmos/opening.ts` during the opening. It is its own canvas, not the forest scene. Colour is the Rust temperature (pink-white, then blue-violet). It is not lit by the forest moon.

Headless: the sphere draws. It does not use the forest shadow program.

## Overlays and UI

The forest HUD is DOM, not a 3D light: `index.html` plus `src/main.ts` (status, footer) and `src/ui/senses.ts` (the wolf-senses card). The status line and the footer still name the controller buttons (`RT`, `LT`, `LB`, and the pad chip in `src/input/padRouter.ts` with `RS` Photo). Those hints were left as they are. The senses halo is `src/render/sensesHalo.ts`, an unlit ring, so it stays visible when the world is dark. That ring is not the ground.

Headless: the DOM is exact. The 3D halo is exact. Neither one tells you whether the terrain shader survived.

# Skill: skin a stored Meshy animal onto the gait it already has

Use when a species gets a file in `public/models/animals` and that file should walk, run, or flap with the body plan it already has. Do not invent a second skeleton or a second loader.

## Search before writing

1. The manifest and the fit are `src/render/animalModels.ts`. `fitAnimalModel` turns file −X (the head) to game −Z, centres the body, and puts the feet on y = 0. Mammals use the shoulder row and `WITHERS_SHARE`. Birds use the group's bill-to-tail length along Z.
2. The gait is `quadrupedPose` in `src/core/animalBehavior.ts`. Canids pass `WOLF_LEGS` so the measured canid plan still runs; the bone lengths scale by the species shoulder over 0.82 m. Cervids scale `DEER_LEGS`. Ursids scale `BEAR_LEGS` (1.05 m hump). Every other mammal uses `MAMMAL_PLANS` ratios through the same pose. Birds flap the wing bones inside the range `skeleton.ts` already gives the humerus.
3. The picture is `src/render/animalPicture.ts`. Specks, then an instanced impostor, then the skinned mesh. Caps are `ANIMAL_LADDER.fullCap` and `lowCap`. `ensureAnimalModels` fetches only the names in the current picture.
4. Meshy game files are meshopt plus WebP. `GLTFLoader.setMeshoptDecoder(MeshoptDecoder)` from `three/examples/jsm/libs/meshopt_decoder.module.js`. Positions are normalized integers. Convert them to float before writing the fit, or anything taller than a metre clamps to −1..1.

## Steps

1. Copy the `.game.glb` into `public/models/animals/<slug>.glb`. Add one manifest row keyed by the `species.ts` name. If the name is not a row, set `as` to the row that owns the size and say so in `_notes`.
2. `loadAnimalBuffer` fits the scene, then `createSkinTemplate` bakes the world matrix into a float geometry, fits a bone chain to that box, and writes four proximity weights per vertex.
3. `spawnSkin` shares that geometry. Each on-screen animal gets its own skeleton and a cloned material (the texture stays shared) so the distance fade can differ. `pose` calls `quadrupedPose` or the wing flap.
4. The picture hides the procedural body (`setBodyShare(0)`) while the skinned mesh or the impostor is up. No file: the procedural body stays.

## Checks

- `tests/meshy-animals.test.ts`: 21 files, meshopt required, nearby-only lookup, shoulder and length fit, weights sum to 1, a run moves the feet, a wing flap moves the tip, the wolf decodes to 26,033 triangles and its height is the 0.74 m shoulder.
- `tests/hare-mesh.test.ts` still refuses a loader inside the procedural hare. The one stored hare is `public/models/animals/snowshoe-hare.glb`.
- `npx tsc --noEmit` and `npm test`.

## Mistakes to avoid

- Do not apply the fit back into a normalized Int16 position. The wolf then stands in a 2 m box with its feet at −1.
- Do not give canids a copy of `WOLF_LEGS` if you still want the measured gait. `quadrupedPose` uses that gait only when the leg row is `WOLF_LEGS` itself. Scale the metres (bob, pelvis) after.
- Do not load all 21 files at startup. Ask for the species in view.
- Do not add a species-named source file. The plan stays data.
- Grizzly, bald eagle: they have their own rows in src/core/species.ts now (issue #162); the manifest names them with no `as`.

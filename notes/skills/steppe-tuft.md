# Skill: prairie stems are tufts

Use when a landing the HUD calls prairie or steppe still draws spruce poles.

## Search before writing

1. The HUD biome is `landingContext`. Prairie is vegetation below 0.62 and at or above 0.28 (`cover-density.json`).
2. The grass ribbon already exists (`render/grass`, Quick_Grass, MIT). Do not add a second blade shader.
3. Black spruce height is 9–15 m (`treeSpecies.ts`, Viereck & Johnston 1990). Stipa lessingiana culms are 30–60 cm (Flora of China 22). A scaled spruce is still a spruce.

## Steps

1. `steppeAt(x, z)` is true when `landingContext` says prairie. It is cached per chunk.
2. `treeGeometry` returns `steppeTuftGroup` for a spruce on that sample, before the v2 `placeTree` hook. The tuft is seven leaning ribbons. Height stays inside 30–60 cm. Width is a clump.
3. The far filler `continue`s on `steppeAt`, so it does not instance a spruce crown on the horizon.
4. A boreal sample still takes the spruce mesh.
5. If the photograph arrives after the chunk was built, `landingContext` changes biome and `buildScene` rebuilds the loaded chunks. `reconcileSteppe` also drops a v2 spruce that is already in the batched-mesh list and stands a tuft there.

## Checks

- `tests/steppe-tuft.test.ts` paints the measured steppe pixel and a 216 m DEM, then fails if the mesh is taller than 60 cm or narrower than 20 cm. It fails the other way if a boreal sample becomes a tuft.

## Mistakes to avoid

- Do not only scale the spruce. A short spruce still reads as a pole.
- Do not add Stipa to the Kenora `COVER_SPECIES` list. That mix is the forest floor.
- Do not treat this as a gait change. The animals are not the defect.

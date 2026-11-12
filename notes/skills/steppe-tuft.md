# Skill: prairie stems are tufts

Use when a landing the HUD calls prairie or steppe still draws spruce poles.

## Search before writing

1. The HUD biome is `landingContext`. Prairie is vegetation below 0.62 and at or above 0.28 (`cover-density.json`).
2. The grass ribbon already exists (`render/grass`, Quick_Grass, MIT). Do not add a second blade shader.
3. Black spruce height is 9–15 m (`treeSpecies.ts`, Viereck & Johnston 1990). Stipa lessingiana culms are 30–60 cm (Flora of China 22). A scaled spruce is still a spruce.

## Steps

1. `steppeAt(x, z)` is true when `landingContext` says prairie. It is cached per chunk.
2. `treeGeometry` returns `steppeTuftGroup` for a spruce on that sample, before the v2 `placeTree` hook. The tussock is nine narrow bent blades (`STIPA_BLADES`, `STIPA_BLADE_M` 12 mm, a game calibration so the setaceous leaf is visible). Height stays inside 30–60 cm. The fan is wider than 20 cm. Three 28 cm triangles read as spikes; `tuftBladeCensus` fails a ground edge wider than 4 cm or fewer than eight tip triangles.
3. The far filler skips `steppeAt`. Horizon tree cards are not drawn when the sample is prairie.
4. A boreal sample still takes the spruce mesh.
5. The photograph often arrives after the first chunks. A cover-tier change has to dispose those chunks and cancel the in-flight chunk job, or the old spruce batch stays in the scene after `borealTreesV2` already reports zero trees. `reconcileSteppe` drops a v2 spruce that was placed before the photo.
6. Replacing the spruce points is not enough for a standing eye. Those points sit outside the 13 m clear. `updateSteppeField` instances the same tuft for 8 m around the camera at 0.5 m spacing. The existing grass shader stays; it was drawing short sprouts, not this culm.

## Checks

- `tests/steppe-tuft.test.ts` paints the measured steppe pixel and a 216 m DEM, then fails if the mesh is taller than 60 cm or narrower than 20 cm. It fails the other way if a boreal sample becomes a tuft.

## Mistakes to avoid

- Do not only scale the spruce. A short spruce still reads as a pole.
- Do not add Stipa to the Kenora `COVER_SPECIES` list. That mix is the forest floor.
- Do not treat this as a gait change. The animals are not the defect.

# T-0198 handoff — grokbot-2

D23. The 40 m eye showed separate plates with sky between them. The drawn ground is now CDLOD (Strugar, GPU Pro, 2010), in `src/world/terrain/cdlod.ts`, built by `src/render/horizonMesh.ts`. The old skirt functions stay for the horizon distance and the tests. They are not the surface.

Branch `grokbot-2/terrain-cdlod`. Not self-approved. Not merged. Gait was not touched. `atmosphere.ts` was not touched. #413, #414, and #422 were not touched.

## What I see

- Before, `tasks/evidence/T-0198/before-eye40.png`: plates, sky in the gaps, a cyan water plate on its own. Main `ce9c552`, the same URL as the after.
- After, `after-eye40.png`: ground from the near trees to the horizon. The chunk patch is darker. Past it the surface is continuous. Pale blue-grey pixels below y=400: 0. The pale strip at the horizon is haze. The 4 m grid reads as a blocky texture, not a step ring and not a hole.
- Before spawn, `before-spawn.png`: the wolf on brown ground, rocks, a blue sliver at the left.
- After spawn, `after-spawn.png`: thatch, the wolf, pups, a lake that meets the far bank, land to the horizon. No plates.

## Numbers

| value | game | real | source | yes |
|---|---|---|---|---|
| finest quad | 4 m | the old ring stepped (56−28)/4 = 7 m | measured on `ringLod`; Strugar 2010 uses one fixed grid per node | yes |
| level step | ×2 | CDLOD range ratio 2 | Strugar, GPU Pro, 2010 | yes |
| horizon at 40 m | 22 576 m | sqrt(2 R h + h²), R = 6 371 000 m | `PLANET.radius`, Moritz 2000; `horizonMetres` | yes |
| horizon at 1.55 m | 4 444 m | same formula | same | yes |

## Gate

`tests/cdlod-ground.test.ts`. A filled disc scores 0 sky pixels below the horizon at the spawn eye and at 40 m. Removing the faces in front of the lens scores above 0. `interiorGaps` is 0 on a flat disc and on ±8 m of relief, and above 0 after faces are deleted. `npx tsc --noEmit` passed.

## Next

Grokbot-1 reviews. Do not merge from this handoff.

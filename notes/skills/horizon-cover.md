# Skill: billboard cover between the chunk trees and the far colour

Use when the drone should show plants past the chunk square, with a different rule for prairie, tundra and desert, without waiting on a new species table.

## Search before writing

1. Near trees are the chunk meshes and `createFarTrees` (`src/render/flora/fartrees.ts`). Do not add a second near-tree system. Those stay inside about 36 m.
2. Far cover is the ground colour (the satellite mosaic or `surfaceColour`). Do not instance a tree at the horizon.
3. The tree line and the ice line are `treeLineM` and `iceLineM` in `src/core/altitudeZones.ts`. Vegetation weight is `vegetationWeight` on the planet sample.
4. `coverKind` in `src/world/globe/coverKind.ts` is a placeholder. The data issue for Grokbot-1 replaces the spacing.

## Steps

1. Classify the landing once: water, ice, rock (more than 80 m above the tree line), tundra, desert, prairie, or boreal.
2. Place billboards with `coverSpots` between 36 m and 520 m. Cap 480. Sort nearest first so the cap does not fill only one corner.
3. One `InstancedMesh` of a vertical plane, height from `heightAt`. The plane samples `treeAtlas`: a conifer on the left, a broadleaf on the right. Alpha test at 0.4 and alpha-to-coverage, so the corner of the card is not drawn. The sprite is brighter on the left (the lit side). Prairie and desert are shorter and use the broadleaf. Water, ice, tundra and rock place none.
4. Past the billboards the skirt samples `canopyTile`, a repeating top-down crown texture, and fades it out before the horizon.
4. Mark `userData.horizonSkirt` so the band hide does not treat it as sky.

## Checks

- `tests/cover-kind.test.ts`: the six classes, spacing, the cap, and no tundra billboards.
- Stills at the T-0108 landings. A boreal landing should show vertical marks between the near patch and the far colour. A water landing should not.

## Mistakes to avoid

- Do not treat sea level at 60° N as rock. The tree line there is already 0 m. Low sites are tundra.
- Do not wait on the density table. The placeholder is labelled calibration. Say so.
- Do not put billboards inside the near ring. They fight the chunk trees.

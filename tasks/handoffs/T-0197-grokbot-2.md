# T-0197 handoff — grokbot-2

## Doing

Birch crowns that are not green balls on sticks. Branch `grokbot-2/birch-crowns`.

## Done

`broadleafCrown` in `src/render/trees.ts` is crossed oval cards. Paper birch aspect is above 1.15. Jack pine is on the same path and is not a ball.

## Next

Grokbot-1 reviews. Not self-approved. The 40 m plates, the 400/800 m canopy noise, the spawn checker, and the pup cutouts are still open.

## How to verify

`npx tsx --test tests/birch-crown.test.ts`

URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40`. Before `tasks/evidence/T-0197/before-eye40.png`, after `tasks/evidence/T-0197/after-eye40.png`.

## Numbers

| what | game | real | source | match |
|---|---|---|---|---|
| birch crown taller than wide | aspect > 1.15 | narrowly oval; live crown about 0.55 of height and width about 0.45 of height, so about 1.2 | Farrar 1995, Trees in Canada; `core/treeSpecies` crownRatio and crownWidth | yes |
| card count | 2 planes at the far LOD, 12 steps | a silhouette, not a leaf count | the billboard atlas is the same idea | yes |

## Frames

The before frame is green balls on sticks. The after frame is tall ragged crowns. The ground plates are still there. D19 and D22 were not edited. Gait was not touched.

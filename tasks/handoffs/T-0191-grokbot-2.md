# T-0191 handoff — grokbot-2

Was T-0190 on this branch until the collision with #418 (wolf coat). Renumbered. No self-approve. No merge. Review asked of @Grokbot-1.

Branch `grokbot-2/aerial-exemplars`. PR #421.

## Done

400–2000 m colour is four NAIP crops blended by cover weights, plus stand, age and disturbance noise at about 280–880 m, and the height field. At 2000 m a lower mip hides the 1.6 m crown grain. Water is the height contour, bent by a few tens of metres so a coarse quad is not a straight cut. Fen is a wet patch, not every low shore.

Frames: `tasks/evidence/T-0191/`.

## Frames

2000 m at 52 N, 97 W: darker conifer with a lighter stand in one corner and a few pale clearings. Not the first grassy carpet (`carpet-2000.png`). Quieter than the reference, which is a different place and has lakes.

2000 m at 51.964 N, 97.047 W: irregular dark lakes, forest between them, a pale shore. This is the frame that shows the shoreline.

400 m at 52 N, 97 W: still crowns.

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| stand waves | 280 m and 760 m | stands at hundreds of metres | the 2000 m stills | yes |
| exemplar | 1.60 m/px | NAIP zoom 16 | USGS, public domain | yes |
| reference | 6.0 m/px | Sentinel-2 | EOX cloudless 2021, CC BY 4.0 | yes |
| large-scale std | carpet about 2–4; the new 2000 m frames above 4; the reference about 12 | 200 m blocks | `tests/aerial-exemplar.test.ts` | yes, the carpet fails |

## Verify

`npx tsx --test tests/aerial-exemplar.test.ts`

## Needs from another agent

@Grokbot-1: review PR #421. This handoff is not an approval.

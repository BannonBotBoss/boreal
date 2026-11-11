# T-0202 handoff — grokbot-2

## Doing

Prairie stems were still spruce after the cover-sample merge. Main `28fad190` is merged in `7c8c6b5`. The tuft edits already contained those cover-sample lines, so the merge does not change the tree. The standing frame was re-shot at the same URL. Not claimed. No approve-plan from this agent.

## Done

A prairie sample no longer keeps a spruce mesh. `treeGeometry` returns a 30–60 cm crossed-card tuft. The far filler skips those points. Horizon tree cards are not drawn on prairie. When the photograph changes the cover tier, the loaded chunks rebuild, so a spruce batched before the photo does not stay. `reconcileSteppe` drops a v2 spruce already in the list. A sward of the same tufts is instanced for 8 m around the camera, because the replaced stems sit outside the 13 m clear and a standing eye never reached one. On a dry prairie sample the open-water sheet and the staged sheet are not drawn. The meshes stay mounted.

## How to verify

`npx tsx --test tests/steppe-tuft.test.ts`. Then the two eye URLs. The HUD stays prairie. The 1.7 m frame shows straw tufts. The 40 m frame does not show spruce.

## Numbers

| value | game | real | source | match |
|---|---|---|---|---|
| culm height | 0.30–0.60 m | 30–60 cm | Flora of China 22, Stipa lessingiana | yes |
| tussock width drawn | 28 cm | a tussock, not the 0.3–0.5 mm blade | Flora of China 22; the blade is sub-pixel, same calibration as hairgrass in `cover.ts` | the blade is not drawn at real width |
| field spacing | 0.50 m | a closed sward, not the 28 m billboard step | `cover-density.json` says the prairie count is not grass tillers. The Akmola photograph is a continuous sward | the 28 m figure is the wrong object |
| flower | past by day 227 | May–July | Flora of China 22 | yes, the tuft is straw |
| black spruce | not drawn on prairie | 9–15 m | Viereck & Johnston 1990 | yes |
| spawn | prairie, vegetation 0.331, 49.77 N, 65.54 E, 216 m | Kazakh steppe | HUD on main `28fad190` | yes |

## Frames

Before 40 m (`tasks/evidence/T-0202/before-eye40.png`): spruce poles, teal-grey water, floating plates.

After 40 m (`after-eye40.png`): poles gone, water sheet gone. Plates, blue horizon, and the brown smear remain. Tufts are not readable from 40 m. Dark-green pixels 302 → 0.

Before 1.7 m (`before-eye1.7.png`): full spruce, leafy pole, water, dirt.

After 1.7 m (`after-eye1.7.png`), re-shot at 08:43 on the merged tree: 805 straw tufts in the foreground. No spruce. The wolf has turned, so the far ridge is not the previous after. Spruce pixels (red under 70, green above red by 35 and above blue by 20, green under 180) score 0; the previous after scored 32.

## Next

Approve-plan from another agent, then a claim. Not self-approved. Gait was not touched. #422, #428, and #429 were not pushed.

## Needs from another agent

Approve-plan before this can be claimed.

# T-0202 handoff — grokbot-2

## Doing

Replace the prairie spruce mesh with a feather-grass tuft. Branch `cursor/steppe-tufts-aef3`. Not claimed. No approve-plan from this agent.

## Done

`treeGeometry` returns `steppeTuftGroup` when `landingContext` says prairie. The far filler skips those points, so the skyline is not a spruce wall. `tests/steppe-tuft.test.ts` passes on this branch.

## How to verify

`npx tsx --test tests/steppe-tuft.test.ts`. Then the eye URL in the task file. The HUD should still say prairie. The stems should be clumps under 60 cm, not poles.

## Numbers

| value | game | real | source | match |
|---|---|---|---|---|
| culm height | 0.30–0.60 m | 30–60 cm | Flora of China 22, Stipa lessingiana | yes |
| blade width drawn | 8 mm | 0.3–0.5 mm setaceous | Flora of China 22; drawn wider for the same reason as wavy hairgrass in `cover.ts` | the real width is sub-pixel; the drawn width is the existing calibration |
| flower | past by day 227 | May–July | Flora of China 22 | yes, mid-August is after anthesis |
| black spruce | not drawn on prairie | 9–15 m | Viereck & Johnston 1990 | yes |
| spawn | prairie, vegetation 0.331, 49.77 N, 65.54 E, 216 m | Kazakh steppe | HUD on main `7f256748`, Sentinel-2 / terrarium | yes |

## Frames

Before (`tasks/evidence/T-0202/before-eye40.png`) is main `7f256748`, eye 40 m. Spruce poles and a cone on the prairie sample.

After (`tasks/evidence/T-0202/after-eye40.png`) is this branch, same URL. `borealTreesV2` reported `trees: 0` and `tufts: 6`, and `steppeAt(0, 0)` was true. The HUD was still prairie, vegetation 0.330, 49.77 N, 65.54 E, 216 m, sun 36.6°. A chunk rebuild runs when that biome changes, so stems placed before the photograph are replaced. Floating plates and the flat blue horizon are still there. Those are #428 and #422.

Reference: `tasks/evidence/path-2026-11-10/ref-astana-steppe.jpg`.

## Next

Grokbot-1 approve-plan, then a claim. Not self-approved. Gait was not touched. #422, #428, #429 were not touched.

## Needs from another agent

Approve-plan from Grokbot-1 or Matthew before this can be claimed.

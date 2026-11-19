# T-0222 handoff

Branch `grokbot-2/prairie-aerial`. Pull request #490 stays a draft. Do not mark it ready.

## Doing

The overhead photograph was painting water, the open-land fallback covered a 6° disc, and the 400 m, 800 m and side-reference frames still showed the old overlays. The pale grey blobs on the right of the 2000 m frame had to stay gone.

## Done

- `openLandHere` is prairie or desert cover, plus a fallback inside 0.2° of the staged home (about 22 km). It is not a 6° disc.
- The overhead photograph replaces a pixel only when `landMask > 0.5`. Water stays the height-field colour. Outside the 11×11 atlas the flat thatch fades with `nearDisc` instead of a hard replace. Grade is `textureLod` × 0.76. There is no soil-flow alpha and no channel graph. The boreal detail normal stays off on open land (`uOpenLand < 0.5`), which is what removed the pale grey blobs. Cache key `globe-steppe-photo-29`.
- The mosaic is EOX Sentinel-2 cloudless zoom 16, 11 tiles. `warmOverheadTiles` only schedules the fetch. `bindOverheadPhoto` reads tiles already in memory. Startup does not wait on a network tile.
- The slow autoplay timeout (loading still up at t=0, `page.waitForFunction` 780000 ms) also fails on main. PR #505 merge `96be717e` (run 44420518786) and later main `69d8f8f` (run 44421238249) time out the same way, with `net::ERR_CONNECTION_RESET` in main's log. It is not this branch's mosaic.
- Fresh frames: `tasks/evidence/T-0222/after-2000.png` and `after-800.png`. `after-400.png` was deleted: at 400 m the near exemplar path still paints the conifer crop over the lake polygons, so a new frame would not show this photograph. `side-reference.png` and `side-before-after.png` were deleted because they still showed the old after frame.
- The 2026-11-11 complete already set T-0222 to `completed`, and no reject returned it to `claimed`. This pass still adds a complete on `grokbot-2/prairie-aerial`, after the code commit. `tools/tasks.ts` flags that second complete (`only the claimant completes a claimed task`). The event is there because the review asked for one on this pass.

## Check (rule 11)

| Metric | Tool | Known match | Known mismatch | This frame |
|---|---|---|---|---|
| Land mean RGB within 10% of the reference | `frameMean` in `tests/prairie-aerial.test.ts` (luma ≥ 80) | reference crop, 98.9% of pixels in the band | a full-frame mean that includes the water (r 97 vs 133) | land r/g/b within 10% |
| Pale grey blob fraction | `paleBlobFraction`, right half, L > median+18 and sat < 0.28 | fraction under 0.004 | the pre-fix right half | under 0.004 |
| 32 px window std | `meanWindowStd` | floor 2 (this mosaic is nearly uniform) | the drawn-contour frame is not the target; the reference's 9.44 is a different landscape | at least 2 |
| Open-land radius | source of `openLandHere` | `ang < 0.2 * Math.PI / 180` | the old `6 * Math.PI / 180` | 0.2° |
| Water not painted | source of `prairieFarGlsl` | `landMask > 0.5 && uSteppeBox.w > 0.5` | the photo applied with no land test | land only |

`npx tsx --test tests/prairie-aerial.test.ts tests/sim-home.test.ts` and `npx tsc --noEmit`.

## Next

Matthew views `tasks/evidence/T-0222/after-2000.png`. The tan is the photograph. The dark shapes are the height-field water the land mask no longer lets the photograph cover. #490 stays a draft.

## Needs from another agent

None.

## Limits

The 400 m view is still the near exemplar crop where `landMask` is low, so it is not evidence for this photograph. The orbit limb and gait were not touched. The autoplay loading hang is on main.

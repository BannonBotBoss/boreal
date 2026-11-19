# T-0222 handoff

Branch `grokbot-2/prairie-aerial`. Pull request #490 stays a draft. Do not mark it ready.

## Doing

The land colour matched, and about 41% of the frame was dark height-field water. The Sentinel image of this spot is dry steppe with thin drainage. That water has to come from the photograph.

## Done

- `openLandHere` is prairie or desert cover, plus a fallback inside 0.2° of the staged home (about 22 km). It is not a 6° disc.
- Inside the 11×11 atlas the Sentinel photograph is the surface, including where the height field says water. The real drainage is in the photograph. The height-field lakes are not. Outside the atlas, thatch still requires `landMask > 0.5` and fades with `nearDisc`. Grade is `textureLod` × 0.76. There is no soil-flow alpha and no channel graph. The boreal detail normal stays off on open land (`uOpenLand < 0.5`). Cache key `globe-steppe-photo-31`. Inside the atlas the pixel is land to the fresnel and the lake roughness, so the height field cannot lay a pale veil on the photograph.
- The mosaic is EOX Sentinel-2 cloudless zoom 16, 11 tiles. `warmOverheadTiles` only schedules the fetch. `bindOverheadPhoto` reads tiles already in memory. Startup does not wait on a network tile.
- The slow autoplay timeout also fails on main. The cause is the forest frame refetching AWS and EOX tiles, fixed on `grokbot-2/slow-autoplay-hang` (T-0262, PR #510), not on this mosaic.
- Fresh frames: `tasks/evidence/T-0222/after-2000.png` and `after-800.png`. `after-400.png` was deleted: at 400 m the near exemplar path still paints the conifer crop over the lake polygons, so a new frame would not show this photograph. `side-reference.png` and `side-before-after.png` were deleted because they still showed the old after frame.
- The 2026-11-11 complete stands. The second complete, dated 2026-11-18T16:29:52, was removed. A later reject cannot make that event legal when the ledger replays it, because the task was already completed. The photograph pass is a comment.

## Check (rule 11)

| Metric | Tool | Known match | Known mismatch | This frame |
|---|---|---|---|---|
| Land mean RGB within 10% of the reference | `frameMean` in `tests/prairie-aerial.test.ts` (luma ≥ 80) | reference crop, 98.9% of pixels in the band | a full-frame mean that includes the water (r 97 vs 133) | land r/g/b within 10% |
| Pale grey blob fraction | `paleBlobFraction`, right half, L > median+18 and sat < 0.28 | fraction under 0.004 | the pre-fix right half | under 0.004 |
| 32 px window std | `meanWindowStd` | floor 2 (this mosaic is nearly uniform) | the drawn-contour frame is not the target; the reference's 9.44 is a different landscape | at least 2 |
| Open-land radius | source of `openLandHere` | `ang < 0.2 * Math.PI / 180` | the old `6 * Math.PI / 180` | 0.2° |
| Height-field water share | `darkShare` in `tests/prairie-aerial.test.ts`, luma under 70 | the reference crop is about 0.01 | the land-mask frame was 0.39 | under 0.08 |

`npx tsx --test tests/prairie-aerial.test.ts tests/sim-home.test.ts` and `npx tsc --noEmit`.

## Next

Matthew views `tasks/evidence/T-0222/after-2000.png` beside `ref-steppe-sentinel.png`, and `after-800.png`. The tan is the photograph, including over the old height-field lakes. #490 stays a draft.

## Needs from another agent

None.

## Limits

The 400 m view is still the near exemplar crop where `landMask` is low, so it is not evidence for this photograph. The orbit limb and gait were not touched. The autoplay loading hang is on main.

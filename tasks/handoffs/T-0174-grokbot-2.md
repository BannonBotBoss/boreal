# T-0174 handoff

Agent: grokbot-2. Branch: `grokbot-2/standing-chunk-reveal`.

## Doing

Cold `startup()` reveals when the interest queue hits its 20 s ceiling. Grass keeps that queue full, so the standing chunk is not required. The embodied view is then a pale void.

## Done

- Before frames in `tasks/evidence/T-0174/`.
- `startup()` runs `settleWhenLandReady` after that ceiling when `land()` is still false. Same 20 s ceiling. No second ceiling constant.
- Test: queue stays busy, chunk appears only after the first ceiling, reveal is after that and under two ceilings.
- After frame `tasks/evidence/T-0174/after-ground.png`: splash left at 52.7 s, lower frame RGB about 56,65,41, green share 0.54. The void is gone. Trunks are still missing in a stand the page calls vegetation 1. That is a separate defect.
- `npx tsc --noEmit` clean. `npm test` 1195 tests, 1181 pass, 0 fail.

## Next

Trunks at this boreal stand, the piled foxes, the "Wolf senses" title while embodied as the hare, the 404 on first load, and the black overhead frames (left to #375 and #371).

## Needs from another agent

None for this wait. Overhead black frames at 400 m and 8000 m are left alone: #375 owns `localClouds.ts` and #371 owns the globe LOD files.

## Numbers

No new rate, density, or size. The wait reuses `COLD_START.settleMaxMs` (20 s) and `COLD_START.settleQuiet` (15 frames).

## Frame

Before: pale field, mid RGB about 228,228,228, non-pale share 0.08. After: ground, lake edge, and rocks, lower RGB about 56,65,41, green share 0.54. Same URL, SwiftShader, 1280×720. A closed boreal stand still has no trunks in the after frame. That comparison is not a pass for the forest picture. It is a pass for the empty reveal.

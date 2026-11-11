# T-0215 grokbot-2

D28. Branch `grokbot-2/ocean-landing`. T-0211 is already `tasks/T-0211-ice-sheet.md` on PR #438. Highest id in PRs #434–#439 is T-0214. This task is T-0215. D29 is T-0216, a second branch.

## Doing

The drop at 8.487 N, 129.334 W. Zoom-0 terrarium pixel (36, 121) is -4589 m. Unfixed `sampleSurface` (planet.ts, not radial.ts) returns h = 5074.600593151878, kind land. `radial.ts` `surfaceRadius` is figure + that height because water is -Infinity. Ice line at 8.5 N is 4633 m, so the class is ice. Vegetation 0.92 on the path frame is the ocean photograph's green-red index, not a forest: `vegetationFromPhoto` starts at 0.55.

Established ocean handling, kept: `landingSite.ts` puts the feet on `LEVEL.waterSurface - 2` when kind is ocean. `landingShore.ts` does not invent a shore when the square is open water, so the aim is not moved. `groundForCover` reports elevation 0 on water.

## Done

- Verified the seeded height matches the HUD 5074 m exactly.
- Zoom-0 grid decoded from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/0/0/0.png`.

## Next

Apply the grid outside the home lift, zero vegetation on water, tree share 0 on open ocean, tests, then frames.

## Needs from another agent

None yet. Reference tile is saved locally from EOX.

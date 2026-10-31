# T-0125 handoff — grokbot-3

Landing wildlife for issue #192. Branch `grokbot-3/wildlife-landing-cast`.

## Doing
Viewer consumes `landing_population` and stands a capped cast after a globe landing. Stylized fill on animals and vegetation. Ten-site in-page captures.

## Done
- `src/core/landingRoster.ts` picks and places from the wasm list. Cap 5. No species the list omits.
- `src/render/landingCast.ts` loads the shared wasm sim, anchors the cast once per 0.01° cell, and reports `borealLanding` on `globalThis`.
- Procedural body for a missing Meshy file (Canada Lynx). Meshy path is the existing picture ladder and gaits.
- Remote landings hide Kenora deer and hares the census does not include.
- `src/render/stylizedPalette.ts` fills mapped animals from their albedo and lifts grass, bark, foliage, and horizon crowns. `inpage.ts` and `sky.ts` were not edited.
- Tests in `tests/landing-cast.test.ts`.

## Next
Ten-site `tools/landing-matrix.mjs` (fall-shot EMBODY, `?latlon=`). Write the table into `tasks/evidence/T-0125/`. Then `npm test`, push, open the PR, wait for CI, squash-merge.

## Needs from another agent
Nothing blocking. For Grokbot-1, on #192: the bridge already exposes the 11-species list, including grizzly and bald eagle. The viewer consumes it. Several of the ten seam clicks are rock, ice, or outside the North American ranges, so the list is empty there. A shore-neighbour sample for a water click would be a sim change, not a viewer one. Prairie moose is not filtered here: if `prairie_per_ha` rounds above zero, the cast shows one.

# T-0194 handoff — grokbot-2

## Doing

The prairie spawn horizon read as a sea. Branch `grokbot-2/prairie-horizon`.

## Done

- Staged chunks no longer add the flat sea square. Lakes and rivers keep their sheet (`t.water`).
- `stagedOpenWater` is a lake, a pond, or a channel. The 8th-percentile line stays a height, not a sea flag.
- The skirt does not fade dry land all the way to the sky fog, and it does not paste a cool flat far texel onto dry ground.
- Before `tasks/evidence/T-0194/before-horizon.png`. After `tasks/evidence/T-0194/after-horizon.png`. Reference is the Comanche National Grassland horizon, public domain, 29 May 2015.

## Next

Grokbot-1 reviews. Not self-approved. Not merged. Gait was not touched.

The issue #192 comment (Done / Evidence / Next / Blockers) could not be posted. `gh issue comment` returns 403, Resource not accessible by integration. The path frames are `tasks/evidence/T-0194/path/`. #420 test is green. #422 is this branch. #423 is the spec map.

## A miss to avoid

A full fade of dry land to the daylight fog is a grey sheet. Capping the haze is not enough if a cool far-layer texel is pasted on first.

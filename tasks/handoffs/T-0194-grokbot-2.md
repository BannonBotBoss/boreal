# T-0194 handoff — grokbot-2

## Doing

D19 and D22 on `grokbot-2/prairie-horizon`. Not merged. Not self-approved.

## Done

The grey-blue band at yaw 2.054 is the horizon skirt. Hiding the water meshes removed nothing. Painting the skirt magenta filled that band. An angle fade did the same, because every skirt fragment sits near the horizontal. The near ring now takes the chunk thatch colour. The outer ring fades by distance toward a blue-grey.

The white sky is three.js `Sky.js` (Preetham, Shirley and Smits 1999) clipped by ACES. Turbidity was about 4 on this morning. The Sky.js exposure scale is applied in the sky shader only. The ground exposure stays 0.5. Scene fog follows Koschmieder (1924) out to 6 km instead of going opaque at 480 m. A narrow horizon-angle mix on the chunk terrain fades rays within about 3° of horizontal. `src/world/globe/atmosphere.ts` was not edited. Gait was not touched.

Same pose as the main frames. Seed 1400, x 65.4, z −18.6, day 227, clock held at 08:46.

| frame | what it shows |
|---|---|
| `tasks/evidence/T-0194/main-66deb5e.png` | Main, yaw 5.140. Flat near-white sky, luma 232, B−R 5. Hard step 99. |
| `tasks/evidence/T-0194/after-horizon.png` | This branch, yaw 5.140. Light blue sky, luma about 210, B−R about 22. Brown thatch. Distant ground goes blue-grey. Step about 63. Cool sheet 0.011. |
| `tasks/evidence/T-0194/spawn-main.png` | Main, yaw 2.054. Wide grey-blue band. Cool sheet 0.068. |
| `tasks/evidence/T-0194/spawn-branch.png` | This branch, yaw 2.054. The wide band is gone. Brown thatch, spruce, hazy distance, a blue patch on the right. Cool sheet 0. Sky luma about 175, B−R about 37. Step about 60. |

The Comanche reference is luma 189, B−R 59, drop 31. The open sky luma is close. B−R is not yet 59 on the brighter heading. The step is smaller than 99 and is not under 45.

## Next

Grokbot-1 reviews. The remaining gap is the sun-facing sky's blue (B−R about 22, not 59) and the horizon step (about 60, not under 45).

## Needs from another agent

None. The token still cannot comment on issues.

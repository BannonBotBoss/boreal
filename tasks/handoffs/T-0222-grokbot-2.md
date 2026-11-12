# T-0222 handoff

Branch `cursor/prairie-aerial-027e`, off main `0f6edb8d`. The pull request stays a draft. Do not mark it ready.

## Doing

The 2000 m hold on the player path was green salt while the HUD said prairie.

## Done

- `coverSampleAt` sets `AERIAL.uOpenLand` for prairie and desert. The aerial crop mixes to the same thatch as the standing ground. Past 20 km, and still inside 400 km, that thatch replaces the spruce vertex colour so the limb is not salt. The orbit disc is farther than that and is unchanged.
- Overhead conifer cards are not drawn for prairie or desert.
- The horizon skirt does not paste the canopy repeat or the 12 m crown grain when `uForest` is 0.
- Prairie terrain keeps the thatch past the old 900 m fade, and the 1.7/m noise drops out with distance.
- Check: `tests/prairie-aerial.test.ts`. Before frame fails. After frame passes. `npx tsc --noEmit` passed.

## Next

Grokbot-2 views `tasks/evidence/T-0222/after-2000.png` and `side-reference.png` before anyone marks the pull request ready.

## Needs from another agent

None.

## Limits

400 m and 800 m centre crops pass the same check. A few green cards remain in the corners of those two frames. The orbit peach band, the uniform orbit land, the grey smudge, and the Antarctic land-mask blocks are on PR #447 and were not edited. Gait was not touched. The token cannot comment on issue #192 (HTTP 403).

# T-0106 handoff (grokbot-3)

Branch: `grokbot-3/time-scale-wiring`. Not claimed. grokbot-3 wrote the plan and does not approve it. grokbot-3 does not merge it.

## Status

Handoff opened at the start of the work. Implementation is in progress on this branch. Claim waits until an approve-plan from someone else is on the board, and that event's `at` is earlier than the claim.

## Review inventory (rule 15)

Checked before the task file was written. 2026-10-28, about 00:07 PT.

- `git fetch origin main`. `origin/main` is `e493650` (T-0104, pull request #151, merged).
- Open pull requests: #152 only (`grokbot-3/three-blocks`, T-0105, roadmap step 19). That plan and that code are grokbot-3's own work. This run did not review it, did not approve it, and did not edit that branch.
- No other open pull request was waiting. Nothing to approve or reject.
- Task ids: `tasks/T-*` on every fetched remote tops out at T-0105 (open pull request #152). No path and no file contents named T-0106, T-0107, or T-0108. T-0106 was free. T-0105 stays on #152. T-0107 is left for the other grokbot-3 agent on step 17, as this run was told. This run did not take it.
- grokbot-2 is offline until about Oct 28 midday Pacific and was not tagged. Grokbot-1 is asked to approve the plan.

## Plan (for approve-plan)

1. `aggregateShare` reads the blend already on `observation()`. `simWorldSec` is the share still on Immediate. `aggregateWorldSec` is the rest. They sum to one forward second. Rewind is 0 for both. The bands stay `SCALE_BOUNDS`.
2. Individuals keep moving through the 8×–12× overlap and stop only once the label has left Immediate. The step 14 shares fade the body across that same blend. The density drawing is on first.
3. The weather cell catches the date with `aggregateWorldSec`, using the existing one-hour nudge. Snow-water eases toward one year of the Kenora normals (snow below 0 °C, melt at the existing degree-day factor) unless the planet already has a snow-water. `weatherAt` shows that mix, so the ground snow follows the same signal. Ground years still advance on every forward second and still refuse a backward gap.
4. From the play camera the density is a flat mottled patch. The camera-facing sprite stays off at wolf height, so it does not become a dome. The embodied animal stays a body.

## What was built

- `src/core/worldClock.ts`. `aggregateShare`, `simWorldSec` (the Immediate share), `aggregateWorldSec` (the rest). They sum to one forward second. Rewind is 0. Bands stay `SCALE_BOUNDS`.
- `src/core/weather.ts`. `weatherAt` mixes the cell toward the climate of the date by that share. `catchUpWeather` uses the existing one-hour nudge. `climatologicalSweMm` is one year of the Kenora normals (snow below 0 °C, melt at `HYDRO.ddf`). `updateWeather` takes the aggregate seconds.
- `src/main.ts`. One `observation()` per frame. Individuals use `simWorldSec`. The weather cell uses `aggregateWorldSec`. Ground years stay on `groundWorldSec`.
- `src/render/animalDensity.ts`. The camera-facing sprite stays gated. A flat mottled patch is the play-camera picture (`groundMarkOpacity`, `groundMarkRadius`).
- `src/render/buildScene.ts`. The census now also reports the scale and the blend. Sync is still before the body fade.
- `tests/time-scale-follow.test.ts`. Skill `notes/skills/time-scale-follow.md`.
- The embodied animal is not folded. `src/render/playables.ts` was not edited.

Focused tests passed (`time-scale-follow`, `coarse-population`, `worldClock`, `weather-cell`, `single-clock`). `npx tsc --noEmit` exit 0. Full `npm test` and the in-game frames are the next step on this branch.

## Needs from another agent

Grokbot-1: please approve-plan T-0106, then review the change and merge it once the GitHub test check is green. grokbot-3 will not approve or merge its own branch. grokbot-2 is not asked.

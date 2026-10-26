# T-0096 handoff (grokbot-3)

Branch: `grokbot-3/one-viewpoint`. Not merged. Not self-approved.

## What this run is doing

Phase 2 of `notes/render-unification-plan.md`: one viewpoint above the band. Issue #107. The forest camera becomes the planet camera from orbit down. Two scenes stay. `blendSec` becomes a no-op. The free-fall entry stays.

## Id scan

`git fetch origin main` and the five open PR heads. Highest task id on any branch is T-0095 (`grokbot-3/no-raw-world`, PR #142). No T-0096 path, event, title, or body. Next free id is T-0096. T-0046 stays unused.

Open PRs, none of which touch `inpage.ts`, `globeView.ts`, `transition.ts`, or `buildScene.ts`:

| PR | Branch | Task | Camera files |
| --- | --- | --- | --- |
| 142 | grokbot-3/no-raw-world | T-0095 | no |
| 141 | grokbot-3/climate-class | T-0094 | no (climate class only; left alone) |
| 140 | grokbot-3/solar-epoch | T-0093 | no (clock file; left alone) |
| 139 | grokbot-3/snow-depth | T-0087 | no (`main.ts`, weather, ground; left alone) |
| 137 | grokbot-3/animals-in-store | T-0092 | no |

All five are grokbot-3's own open work. Not reviewed here. grokbot-2 is offline and is not tagged.

## Done

- [ ] Pose shared, handover is a no-op, orbit uses the forest camera
- [ ] Tests, `npx tsc --noEmit`, `npm test`
- [ ] Stills at orbit, 2 km, 600 m, 60 m
- [ ] Skill, agent notes, pull request

## Exact next step

Share the band pose, make `handoverBlend` a no-op, and drive the planet camera from the forest camera above the band when the mapping round-trips within a centimetre. Do not retune the fall.

## Needs from another agent

Grokbot-1: approve-plan for T-0096, then review and merge the pull request. grokbot-3 cannot approve its own plan.

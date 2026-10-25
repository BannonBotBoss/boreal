# T-0010 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/wolf-autonomous-core`. Clock: Pacific (America/Vancouver, UTC-7). Issue #6.

## What this run is doing
Wolf Autonomous mode on the shared agent core. The plan agy approved on 2026-10-21 11:45 PT stands. T-0009 is completed on main, so the dependency is met. Claim: `tasks/events/2026-10-25T00-13-42-grokbot-3-claim-T-0010.json`.

## Already on main, not this task
- T-0005 is still claimed by grok-globe. `seatLog` and the bark hook are already in `src/render/geometry.ts`. Not branched.
- T-0070 (PR #66, grokbot-1) is claimed, not completed. CI on that PR is green. This run does not review it and does not approve it.
- Deer still call `AnimalBrain.decide` (T-0011). Stripping those branches now would idle the herd and fail `tests/animal-behavior.test.ts`. The autonomous wolf no longer enters `decide` without a player command (`main.ts`).

## Exact next step
Wire `BEHAVIOUR.wolf`, `plan()`, and `autonomousWolfStep` through `stepAgent`. Then the numbers table, the position gate, `npx tsc --noEmit`, and `npm test`.

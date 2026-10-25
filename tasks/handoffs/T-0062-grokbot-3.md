# T-0062 handoff — grokbot-3

Issue #46. Agent grokbot-3. Branch `grokbot-3/planet-fundamentals`.

## Why this issue
- #27 (T-0032) is claimed. Valid claim `tasks/events/2026-10-22T02-19-grok-claim-T-0032.json` (agent grok, branch `grok/T-0032-forest-edge`). GitHub still labels it `state:claimed` / `agent:claude`. Not taken.
- #29 (T-0034) is done on main. `startView` is in `src/world/globe/startView.ts`. PR #33 merged. Approve event 2026-10-22T02:31. Not taken.
- #32 (T-0038) is plan-approved and unclaimed, but the remaining step is a GitHub project. `createProjectV2` on org `BannonBotBoss` returns FORBIDDEN for `cursor[bot]`. The task text says that needs `gh auth refresh -s project`. That is something only Matthew can grant. Not taken.
- #43 is the planet-budget issue. T-0056 and T-0057 are already on main. T-0058 and T-0059 are still open budgets, and T-0061 left globe wiring undone. One run cannot close #43. Not taken.
- #46 (T-0062) is the rust folder layout Matthew wrote in the issue. Plan approved by grok for Matthew at 2026-10-23T13:22:30-07:00. No claim on any branch. No open PR. The flat `rust/boreal-sim/src/*_budget.rs` files are still the tree on main. Nothing here needs a secret or a sign-in.

## Doing
Move and split the existing budget sources into `rust/boreal-sim/src/planet_fundamentals/` to match issue #46. No new formulas. Wasm export names stay `grid_init`, `grid_seed`, `grid_step`. `layout_version` stays 3.

## Done
- Handoff created.
- Claim event written after the existing approve-plan. Not a new approve-plan. Not a self-approval.

## Exact next step
Create the `planet_fundamentals` tree from the table in `tasks/T-0062-planet-fundamentals-layout.md`, point the old module names at it so there is one copy of each formula, run `cargo test` and `npm test` / `npx tsc --noEmit`.

## Needs from another agent
None yet.

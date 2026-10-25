# T-0062 handoff — grokbot-3

Issue #46. Agent grokbot-3. Branch `grokbot-3/planet-fundamentals`.

## Why this issue
- #27 (T-0032) is claimed. Valid claim `tasks/events/2026-10-22T02-19-grok-claim-T-0032.json` (agent grok, branch `grok/T-0032-forest-edge`). GitHub still labels it `state:claimed` / `agent:claude`. Not taken.
- #29 (T-0034) is done on main. `startView` is in `src/world/globe/startView.ts`. PR #33 merged. Approve event 2026-10-22T02:31. Not taken.
- #32 (T-0038) is plan-approved and unclaimed, but the remaining step is a GitHub project. `createProjectV2` on org `BannonBotBoss` returns FORBIDDEN for `cursor[bot]`. The task text says that needs `gh auth refresh -s project`. That is something only Matthew can grant. Not taken.
- #43 is the planet-budget issue. T-0056 and T-0057 are already on main. T-0058 and T-0059 are still open budgets, and T-0061 left globe wiring undone. One run cannot close #43. Not taken.
- #46 (T-0062) is the rust folder layout Matthew wrote in the issue. Plan approved by grok for Matthew at 2026-10-23T13:22:30-07:00. No claim on any branch. No open PR. The flat `rust/boreal-sim/src/*_budget.rs` files were still the tree on main. Nothing here needs a secret or a sign-in.

## What was built
The budget sources now live in `rust/boreal-sim/src/planet_fundamentals/` in the issue #46 tree. Each formula is in one file. `lib.rs` re-exports the old module names (`solar_budget`, `surface_budget`, `hydrosphere_budget`, `atmosphere_budget`, `climate_seed`, `update_energy`, `update_moisture`, `update_clouds`, `update_wind`) so callers and the wasm names do not grow a second copy. `Grid::seed` delegates to `planet_initialization::initialize`. `Grid::step` delegates to `planet_update::advance`. The call order inside those two functions is the order the methods had. `layout_version` stays 3. `vegetation_fraction.rs` is a comment stub. Land and elevation are the existing plane indexes, not a new mask.

`public/wasm/boreal_sim.wasm` was rebuilt from this source (129905 bytes).

## How to verify
- `tests/planet-layout.test.ts` lists the 23 issue files, asserts the nine flat budget files are gone, asserts `vegetation_fraction.rs` has no `pub fn`, asserts `grid_init` / `grid_seed` / `grid_step` and `layout_version` 3, and asserts `solar`, `bucket_step`, and `surface_pressure` are each defined once.
- `npm run test:rust` (`cargo test` in `rust/boreal-sim`).
- `tests/planet-budget.test.ts` (`wasm solar budget equals weather.ts solar() and shortwave() to 1e-9`).
- `npx tsc --noEmit` and `npm test`.

## Number table
No new physical constant. Every cited value moved with its comment.

| Value | Game number | Real figure + source | Resembles? |
|---|---|---|---|
| Land SST sentinel | −999 | Not a temperature. The seed already wrote −999 on land (`grid.rs` before this move). `sst.rs` names that sentinel. | N/A sentinel, same value |
| Solar golden | `cos_z` 0.8112594631176723, tolerance 1e-12 | `solar(227, 12, 49.79, -94.36, -6)` from `weather.ts`, NOAA/Spencer | yes (test passed) |
| Wasm parity | absolute error < 1e-9 | `tests/planet-budget.test.ts` against `weather.ts` `solar` / `shortwave` | yes (test passed) |
| Bucket | 150 mm, overflow of 140+30 is (150, 20) | Manabe 1969, `BUCKET_MM` | yes (test passed) |
| Heat capacities | ocean 4.18e6×50, land 2.0e6×0.5 | Wallace & Hobbs 2006; Oke 1987 Table 2.1. Unchanged. | yes |

## Gates
- **Numbers:** pass. The table above. Nothing was retuned.
- **Frame:** N/A. This task does not change a mesh, a shader, a camera, or a colour. There is no frame to match. A generated picture would not certify the folder layout.
- **Substitute numeric check (rule 11):** `cargo test` golden `solar_matches_typescript` (known match: the weather.ts cos_z above; a wrong declination fails the 1e-12 bound). `tests/planet-budget.test.ts` known match is wasm versus `weather.ts` under 1e-9, and that test passed on the rebuilt wasm. Tool: `npm test` and `cargo test`. Calibration is the tolerance already written in those tests.
- **Evidence (rule 12, this is a layout):** the file list is the finding, `tests/planet-layout.test.ts` is the spot-check, and the single-definition assertions are the "no second formula" check.

## Tests (this run)
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml`: 70 passed, 0 failed.
- `npx tsc --noEmit`: exit 0.
- `npm test`: 758 tests, 744 pass, 0 fail, 14 todo. The todo is the existing ledger rule-break check.

## Housekeeping
Task ids on this branch: 72 task files, 72 ids, no duplicate. The only gap from T-0001 through the highest id is T-0046, which the T-0021 handoff reserved. No renumber.

## Needs from another agent
None. Another agent reviews and merges. grokbot-3 does not approve this PR.

## Leftovers
T-0063 still owns Matthew's boot order. This move did not reorder `initialize` or `advance`. `vegetation_fraction.rs` is still later, as the issue says.

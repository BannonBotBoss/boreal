# Grok loop handoff: issues #46 and #47

Branch: `grok/issues-46-47`. Base: `main` at `fd65b8d`. Matthew's PC is offline, so this run is the repo only. It does not touch `grok/board-loop`, PR #41, or PR #44. PR #48 (`grok/planet-solar-budget`, T-0057) opened during this run and was not edited.

## Doing
Map GitHub issues #46 and #47 onto tasks. File a task only for what T-0061 and T-0057..T-0059 do not already cover. Audit the direct-to-main T-0061 pushes. One PR to `main`, not merged.

## Done
- Read `tasks/RULES.md` on `main` and both issues verbatim (bodies compared to the approve-plan notes).
- **#46 is not covered.** T-0061's crate is flat (`rust/boreal-sim/src/lib.rs` modules `solar_budget`, `surface_budget`, `hydrosphere_budget`, `atmosphere_budget`, `climate_seed`, `update_*`, `grid`). T-0057..T-0059 put the same names in TypeScript under `src/core/planet/` and say the tree is TypeScript. Filed **T-0062** (propose `2026-10-23T13:22:00-07:00`, approve-plan for Matthew `13:22:30`, quoting issue #46).
- **#47 is not covered.** `Grid::seed` (`rust/boreal-sim/src/grid.rs` lines 39-52) mixes the seed and calls `update_energy(self, 1.0)`. `startGlobe` (`src/world/globe/globeView.ts`) never loads `PlanetSim`. T-0057..T-0059 own drawing layers, not this boot list. Filed **T-0063** (propose `13:23:00`, approve-plan for Matthew `13:23:30`, quoting issue #47).
- T-0061 audit comment: `tasks/events/2026-10-23T13-24-grok-comment-T-0061.json`. Nothing reverted.
- Issue comments posted on #46 (T-0062) and #47 (T-0063). No game code in this branch.

## Evidence (rule 12)
| finding | evidence | became |
|---|---|---|
| #46 names `planet_fundamentals/{energy,hydrosphere,atmosphere,surface}` plus three root files | issue #46 body, 2026-10-23 12:27:56 PT | T-0062 |
| T-0061 is a flat crate, not that tree | `rust/boreal-sim/src/lib.rs` lines 4-13; commits `2ef3cbb`, `a912574`, `fd65b8d` | linked from T-0062, not duplicated |
| T-0057..T-0059 are TypeScript globe layers for issue #43, and they decline a Rust tree | `origin/grok/board-loop:tasks/T-0057-planet-solar-budget.md` ("The tree is TypeScript"); same for T-0058 and T-0059 | linked, not duplicated |
| #47 is a 13-step boot ending in "Render globe" | issue #47 body, 2026-10-23 12:29:54 PT | T-0063 |
| Current seed order is not that list, and the globe never calls it | `rust/boreal-sim/src/grid.rs` lines 39-52; no `loadPlanetSim` under `src/world/globe/` | T-0063 |
| T-0061 reached `main` with no PR | parents `5bc3dc1` → `2ef3cbb` → `a912574` → `fd65b8d`; `gh pr list` has no PR for those SHAs; CI run 40013842872 passed | comment event, not a revert |
| T-0061 has propose, skill file, and handoff | `tasks/events/2026-10-23T12-45-grokbot-1-propose-T-0061.json`; `notes/skills/rust-wasm-planet-budgets.md`; `tasks/handoffs/T-0061-grokbot-1.md` | recorded as present |
| T-0061 has no approve-plan, no claim before the code, no complete, no frame evidence, and the skill is not named by a complete event | only two T-0061 events exist; comment `2026-10-23T12-45-30` says the quotes are not an approve-plan; no `refs/` screenshots in `fd65b8d` | recorded as missing |

A reviewer can spot-check three rows: the issue bodies against the approve-plan notes, `lib.rs` lines 4-13, and `grid.rs` lines 39-52.

## Tests
`npm test`: 508 pass, 0 fail, 13 todo (the board rule-break check stays a todo, 20 legacy events, unchanged by this run). `npx tsc --noEmit`: exit 0.

## Exact next step
Claim **T-0062** and move `rust/boreal-sim` into `src/planet_fundamentals/` using the file map in the task (no new formulas). Then claim **T-0063** and call that ordered init from `startGlobe` / `createGlobe` before the first frame. Both plans are already approved for Matthew. Do not do that code on `grok/board-loop`, and do not edit PR #41, #44, or #48.

This PR stays open. Do not merge it and do not push `main`.

## Needs from another agent
None for this board run. Whoever claims T-0063 still owes a globe recording when the boot is visible (rule 6). That is not this run.

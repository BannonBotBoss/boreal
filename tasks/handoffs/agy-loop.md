# agy-loop Handoff (2026-11-19 15:42 PT — In Progress: Step 0 Fresh Reviews on Updated PR #490 & PR #492)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `b9cf0ddc` (includes PR #488 `T-0254`, PR #535 `T-0276`, PR #536 `T-0277`; merged into `agy/loop` at `4d03e5cc`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-19T15:40-07:00` PT (stop before `16:30` PT).

## What Is Done
1. **Sync & Step 0 Inventory (Rule 15 & Rule 17, Oldest First):**
   - Ran `git fetch origin`, merged `origin/main` (`b9cf0ddc`) into `agy/loop` (`4d03e5cc`), ran `gh pr list --state open`, `npx tsx tools/tasks.ts`, and `git for-each-ref --sort=-committerdate`.
   - Open non-`agy` PRs (6 total; `#488` `T-0254` merged into `origin/main` at `b9cf0ddc`):
     - `#413` (`cursor/revert-generate-universe-on-existing-17ad`), `#414` (`cursor/universe-app-17ad`), `#448` (`cursor/prairie-aerial-027e`, Draft), `#449` (`cursor/ocean-scorecard-423d`, Draft): unchanged since `2026-11-14`.
     - `#490` (`grokbot-2/prairie-aerial`, `T-0222`): **UPDATED** head `71e78974 -> b7250246` (15:28 PT merge of `origin/main` `b9cf0ddc`; CI `test` passed, `slow` pending; `agent-review` cleared by new head SHA).
     - `#492` (`grokbot-2/globe-leftovers`, `T-0256`): **UPDATED** head `a9a6463e -> 7b465e94` (15:29 PT merge of `origin/main` `b9cf0ddc`; CI `test` passed, `slow` pending; `agent-review` cleared by new head SHA).
   - Confirmed `T-0278` is the next free task ID across all branches.

## Current Step
- Performing fresh Rule 15 non-author verification (oldest first) on updated PR `#490` (`b7250246`, `T-0222`) and PR `#492` (`7b465e94`, `T-0256`) — checking conflict resolutions, `npx tsc --noEmit`, `npm test` (relevant + `sim-home` + `rules` + `gait-gate` + `tasks`), and posting `agent-review` status via `tools/agent-review.mjs`.

## Exact Next Step
1. Complete fresh verification & `agent-review` posting on PR `#490` (`b7250246`) and PR `#492` (`7b465e94`).
2. Proceed to Step 1–3: inspect untouched core/sim subsystems (`rust/boreal-sim/src/gas.rs`, `rt.rs`, `interior.rs`, `emergent.rs`, `sun_spectrum.rs`, `deep_time.rs`, `climate.rs`, `biosphere.rs`, or `src/core/logDecay.ts`, `why.ts`, `traces.ts`, `bodyFeelings.ts`, `sensePictures.ts`, `contactBus.ts`, `events.ts`, `deltas.ts`, `senses.ts`) to pick the highest-impact real-world gap area for `T-0278` with live Chromium frames/recording, photoreal references, and calibrated Rule 11 metrics against published nature sources.
3. Propose `T-0278` on `agy/t0278-propose`, create/update a reusable skill under `notes/skills/`, open PR, merge into `agy/loop`, and close browser/server cleanly.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0277`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

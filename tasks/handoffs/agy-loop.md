# agy-loop Handoff (2026-11-19 17:42 PT — In Progress: Step 0 Verified, Starting T-0280 Subsystem Audit)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `620b3074` (merged into `agy/loop`; already up to date). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T17:40` PT (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` & `git merge origin/main`: `origin/main` remains `620b3074` (`Already up to date`).
   - Open non-`agy` PRs checked:
     - **PR `#490` (`grokbot-2/prairie-aerial` @ `dae5c694`, `T-0222`)**: unchanged head SHA `dae5c694`, already freshly approved by `agy` at `2026-11-19T23:42:23Z` (`agent-review: SUCCESS`, CI `test` green, `slow` in progress).
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged since `2026-11-14` (Rule 15 amendment; prior blocking status retained).
   - Open `agy` PRs `#538` (`T-0278` @ `3d8a10e2`) and `#539` (`T-0279` @ `16c02657`): `test` CI green, `slow` in progress, awaiting non-`agy` merge/plan approval.
   - No `agy` proposed tasks (`T-0224..T-0279`) have received a non-author `approve-plan` yet.
2. **Step 1 — Starting Untouched Subsystem Audit (`T-0280`):**
   - Surveying untouched subsystems in `rust/boreal-sim/src/` (planetary formation, gas envelope, interior, differentiation, reheating, radiative transfer `rt.rs`, `sun_spectrum.rs`, `cosmology.rs`, `cosmic_time.rs`, `planet_eval.rs`) and `src/world/globe/` (`handoff.ts`, `cube.ts`, `farLayer.ts`, `tileWorker.ts`, `bootOrder.ts`, `plates.ts`, `figure.ts`, `flight.ts`, `transition.ts`) to pick the highest-impact untouched area for calibrated Rule 11 + live Chromium frame verification.

## Exact Next Step
1. Complete code + mathematical + live Chromium inspection of the chosen untouched subsystem.
2. Write calibrated Rule 11 audit script, record live WebGL video + PNG frames + real-world reference images, verify zero overlap with existing tasks, and propose `T-0280` on `agy/t0280-propose` with PR, handoff, and reusable skill.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0279`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of PR `#490` (`T-0222` @ `dae5c694`, once `slow` passes), board-only PR `#538` (`T-0278` @ `3d8a10e2`), and board-only PR `#539` (`T-0279` @ `16c02657`).

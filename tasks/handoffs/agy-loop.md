# agy-loop Handoff (2026-11-20 01:40 — In Progress: Step 0 Verified, Auditing Untouched Subsystems for T-0283)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `6c350938` (`PR #541` / `T-0281` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-20T01:40` (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` & `git merge main`: `origin/main` remains `6c350938` (`PR #541` / `T-0281`); `agy/loop` up to date with `main`.
   - Open non-`agy` PRs checked (`gh pr list -R Bannon-github/boreal --state open`):
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs (`05cb5735`, `26381111`, `e9d8d50b`, `83d1b0ec`) since `2026-11-14` (Rule 15 amendment; prior blocking status retained).
     - **PR `#542`** (`agy/t0282-propose`, `8d84db7f`): own board-only proposal for `T-0282`; `test` check green, `slow` running.
   - Checked `npx tsx tools/tasks.ts` and `tasks/events/*.json` across all branches: no new non-`agy` pending `complete` or `propose` reviews (older blocked items `T-0001`, `T-0007`, `T-0067`, `T-0123`, `T-0118..T-0214` unchanged); no `agy` proposed tasks (`T-0224..T-0282`) have received a non-author `approve-plan` yet. Next free task ID across all branches: **`T-0283`**.

## What I Am Doing Now
- Surveying untouched subsystems (`src/animals/locomotion/{stancePlan,touchdownPlan,jointSwing,bodyPlan,softIK,spring,contactScore,lab}.ts`, `src/core/{wolfBody,coat,contactBus,transactions,timescale,stateFields}.ts`, `src/world/globe/{figure,logDepth,origin,tileWorker,bootOrder}.ts`, `src/input/{autoplay,padTargets}.ts`, `rust/boreal-sim/src/{sun_spectrum,consts,params}.rs`, etc.) to select real, nature-verifiable, zero-overlap gaps for live Chromium recording + calibrated Rule 11 verification -> `T-0283`.

## Exact Next Step
1. Inspect candidate untouched modules and verify zero overlap against `T-0001..T-0282`.
2. Run live headless Chromium recording + frame capture on preview port `5267` (killed after run) and generate reference images + calibrated Rule 11 script under `refs/audit/<slug>/`.
3. Propose `T-0283` on a clean `agy/t0283-propose` worktree with task file, propose event, handoff, and skill; open board-only PR; merge into `agy/loop` and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0282`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PR `#542` (`T-0282` on `agy/t0282-propose`).

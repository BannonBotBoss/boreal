# agy-loop Handoff (2026-11-20 06:40 — In Progress: Step 0 Verified, Auditing Unaudited Viewers, Gait Sheets & Diagnostic Tools for T-0288)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `61eb666c` (`PR #546` / `T-0286` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-20T06:40-07:00` (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune`: `origin/main` advanced `ab748944 -> 61eb666c` (`PR #546` / `T-0286` merged); merged into `agy/loop`.
   - Open non-`agy` PRs checked (`gh pr list --state open`):
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs (`05cb5735`, `26381111`, `e9d8d50b`, `83d1b0ec`) since `2026-11-14` (Rule 15 amendment; prior blocking verdicts retained).
     - **PR `#547`** (`agy/t0287-propose`, `512c8176`): own board-only proposal for `T-0287` (`ci` `test` + `slow` green).
   - Checked `npx tsx tools/tasks.ts` and `git log --all --since="2026-11-18" -- tasks/`: no new non-`agy` pending `complete` or `propose` reviews since `2026-11-18`. No `agy` proposed tasks (`T-0224..T-0287`) have received a non-author `approve-plan` yet. Next free task ID across all branches is `T-0288`.

## What I Am Doing Now
- Surveying remaining unaudited viewers, species/gait/skeleton sheet tools, diagnostic/baking/constant-generation scripts, and live end-to-end flows on `origin/main` (`61eb666c`) with zero overlap with `T-0001..T-0287`.
- Will run a temporary Vite preview server on port `5269`, capture live Chromium frames + video + calibrated Rule 11 measurements, and propose `T-0288` on branch `agy/t0288-propose`.

## Exact Next Step
1. Complete audit of unaudited viewers/diagnostic tools and live browser/gameplay checks, build calibrated `refs/audit/<slug>/audit.ts`, capture frames/video/references, and propose `T-0288`.
2. Push `agy/t0288-propose`, open board-only PR, merge into `agy/loop`, verify `npx tsc --noEmit` + tests, stop all temporary servers/browsers, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0287`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PR `#547` (`T-0287`).

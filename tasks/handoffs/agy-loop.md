# agy-loop Handoff (2026-11-20 07:40 — In Progress: Step 0 Verified, Auditing Remaining Untouched Core/Input/UI/Tools & Live Gameplay Flow for T-0289)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `6382e99a` (`PR #547` / `T-0287` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-20T07:40-07:00` (50 min cap -> stop by `08:30`).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin`: `origin/main` advanced `61eb666c -> 6382e99a` (`PR #547` / `T-0287` merged); merged into `agy/loop` (`90061f1b`).
   - Open PRs checked (`gh pr list --state open`):
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs (`05cb5735`, `26381111`, `e9d8d50b`, `83d1b0ec`) since `2026-11-14` (Rule 15 amendment; prior blocking verdicts retained).
     - **PR `#548`** (`agy/t0288-propose`, `3ee2e413`): own board-only proposal for `T-0288`.
   - Checked `npx tsx tools/tasks.ts` and `git log --all --since="2026-11-18" -- "tasks/events/*.json"`: no new non-`agy` pending `complete` or `propose` reviews since `2026-11-18`. No `agy` proposed tasks (`T-0224..T-0288`) have received a non-author `approve-plan` yet. Next free task ID across all branches is `T-0289`.

## What I Am Doing Now
- Surveying untouched files across `src/`, `tools/`, and `rust/boreal-sim/src/` plus live browser gameplay/UI flows (`?autoplay=1`, title-menu-to-ground, gamepad menu / `padTargets` / `menu-frame-measure`, locomotion/contact/rig probe tools, `catalog`/`stateFields`/`bootOrder`) to run a calibrated Rule 11 inspection and propose `T-0289`.

## Exact Next Step
1. Complete code + live Chromium recording & calibrated Rule 11 inspection on untouched subsystems.
2. Save evidence (`audit.ts`, `numbers.json`, `recording.webm`, `frame-*.png`, reference frames), create `tasks/T-0289-*.md`, propose event, handoff, and skill on a fresh `agy/t0289-propose` worktree.
3. Verify `npx tsc --noEmit` and board/rule tests, push branch, open PR, merge into `agy/loop`, and finalize this handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0288`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PR `#548` (`T-0288`).

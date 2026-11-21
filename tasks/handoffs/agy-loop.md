# agy-loop Handoff (2026-11-20 18:40 PT — In Progress: Step 0 Verified, Auditing Live Hunting, World Interactions, Photo/Chronometer/Inspector & Pause Menu Round-Trips for T-0298)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `d07a5696` (`PR #558` T-0297 merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-20T18:40-08:00` PT (stopping before 50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch --all --prune` + `git merge --no-edit origin/main` (`d07a5696`) into `agy/loop`.
   - Verified all 4 open non-`agy` PRs on `Bannon-github/boreal`:
     - `#413` (`cursor/revert-generate-universe-on-existing-17ad`, head `05cb5735`, `updatedAt 2026-11-14T03:58:19Z`, comments `1`, reviews `0`)
     - `#414` (`cursor/universe-app-17ad`, head `26381111`, `updatedAt 2026-11-14T03:58:21Z`, comments `1`, reviews `0`)
     - `#448` (`cursor/prairie-aerial-027e`, head `e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`, comments `1`, reviews `0`)
     - `#449` (`cursor/ocean-scorecard-423d`, head `83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`, comments `2`, reviews `0`)
     All 4 are completely unchanged since the previous blocking reviews; blocking verdicts retained under Rule 15's unchanged-blocked-submissions amendment.
   - Verified task ledger across all branches (`tasks/events/*.json` and `git log --all -- tasks/`): latest non-`agy` event remains `2026-11-18T19-08-15-grokbot-2-complete-T-0254.json`; zero new non-`agy` completed or proposed tasks waiting on review, and zero new non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0297`.
   - Confirmed next free task ID across all branches: **`T-0298`**.

## Currently Doing
- Surveying and running live headless Edge inspection (with screen recording, sampled frames, matched natural/spec references, and calibrated Rule 11 script) on untouched live gameplay flows:
  1. Active wolf hunting loop (lock-on `Q`, steered pounce `Space`, pin, eat `X`, release `B` + temporary friendship, hare ecology/numbers)
  2. Live world interactions (`E` snout-push rock, gather herb, speak to Visitor/Deer, `F` focus-lock, `T` chronometer, `I` Generation Inspector, `P` Photo Mode + Rewind)
  3. Live Pause Menu sub-panels (`Player / Play as`, `Appearance`, `Graphics / Render settings`, `Music`, `Controls`, `Planet view`) and Autonomous Wolf mode.

## Exact Next Step
1. Inspect source modules (`src/animals/hare.ts`, `src/core/hunt.ts`, `src/core/huntHold.ts`, `src/ui/menu.ts`, `src/photo/photoMode.ts`, `src/ui/inspector.ts`, `src/ui/chronometer.ts`, `src/core/events.ts`).
2. Run a live headless Edge session on a temporary `agy` Vite port (`5265`), capturing `recording.webm`, live PNG frames, and telemetry JSON (`live-capture.json`), cleanly closing browser and server in `finally`.
3. Source real natural references, build calibrated `refs/audit/<slug>/audit.ts` -> `numbers.json`, verify `tsc` and board/guardrail tests, create `tasks/T-0298-<slug>.md`, propose event, handoff, and skill on `agy/t0298-propose`, open PR, merge into `agy/loop`, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0297`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

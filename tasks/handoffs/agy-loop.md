# agy-loop Handoff (2026-11-20 17:40 PT — In Progress: Step 0 Verified, Live End-to-End Autoplay / Multi-Biome Ground Landing / Save-Continue / Time-Dial Audit for T-0297)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `c4209c0b` (`PR #556` T-0295 & `PR #557` T-0296 merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-20T17:40-08:00` PT (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch --all --prune` + `git merge origin/main` (`c4209c0b`) into `agy/loop`.
   - Verified open non-`agy` PRs (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b`, `#449` `83d1b0ec`): all `4` remain completely unchanged in head SHA, `updatedAt` (`2026-11-14`), comment counts (`1, 1, 1, 2`), and review counts (`0`). Blocking verdicts retained under Rule 15's unchanged-blocked-submissions amendment.
   - Verified `tools/tasks.ts` ledger across all branches: zero new non-`agy` events since `2026-11-18T19:08:15-08:00`, zero new `approve-plan` events on `agy` proposed tasks `T-0224..T-0296`. Next free task ID across all branches: **`T-0297`**.
2. **Audit Scope Selection (Zero Overlap with `T-0001..T-0296`):**
   - Surveying previously untested live end-to-end player flows in headless Edge on temporary `agy` port `5264`:
     1. Live `?autoplay=1` full end-to-end visit (Start menu -> Universe options -> Seed 1400 -> Title film -> Globe -> Descent -> Ground walk) + screen recording.
     2. Live multi-biome remote globe-to-ground landings (`inpage` descent onto Sahara Desert, Greenland Ice, Amazon Rainforest, Open Ocean) — checking actual ground rendering, flora/fauna, weather, and height seams.
     3. Live gameplay loop round-trips: Save (`Esc -> Save`) -> Reload -> `Continue`, live Time Dial (`,` / `.` / `;`), and pause menu / interaction flows.

## Exact Next Step
1. Start temporary Vite server on port `5264` and run a live headless Microsoft Edge capture + calibrated audit script covering live `?autoplay=1`, live multi-biome remote ground landings, live Time Dial, and live Save/Reload/Continue round-trips.
2. Inspect all captured live frames against natural documentary references, compute calibrated Rule 11 metrics (`audit.ts` -> `numbers.json`), create `tasks/T-0297-<slug>.md`, event JSON, handoff, and skill on a fresh worktree `C:\dev\boreal-agy-t0297` (`agy/t0297-propose`), push, open PR, and update this handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0296` (and upcoming `T-0297`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

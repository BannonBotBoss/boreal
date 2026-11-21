# agy-loop Handoff (2026-11-21 03:42 PT — In Progress: Step 0 Verified, Auditing Live Data (U) / CosmosSphere, Viewfinder Camera & Gallery Export / Badge Lock, Save & Corrupt-Storage Recovery, and Standalone Viewers for T-0302)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `dcd1d9d2` (`PR #559` T-0298 merged into `origin/main`, merged into `agy/loop`; `PR #560` T-0299 open on `agy/t0299-propose` @ `c15483c7`; `PR #561` T-0300 open on `agy/t0300-propose` @ `39627a36`; `PR #562` T-0301 open on `agy/t0301-propose` @ `a32499d6`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-21T03:40-08:00` PT (stop well before `04:30-08:00` PT).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` + `git merge main` (`Already up to date` with `origin/main` `dcd1d9d2`).
   - Verified all `4` open non-`agy` PRs via `gh pr list -R Bannon-github/boreal --state open`: `#413` (`05cb5735`, `2026-11-14T03:58:19Z`), `#414` (`26381111`, `2026-11-14T03:58:21Z`), `#448` (Draft, `e9d8d50b`, `2026-11-14T03:59:39Z`), and `#449` (Draft, `83d1b0ec`, `2026-11-14T04:01:58Z`). All `4` remain unchanged; blocking verdicts retained under Rule 15's unchanged-blocked-submissions amendment.
   - Verified `tasks/events/*.json` and `tasks/T-*.md`: zero new non-`agy` completed or proposed tasks waiting on review since 2026-11-10, zero new `approve-plan` events on `agy` proposed tasks (`T-0224..T-0301`), max task ID across all branches is `T-0301`. Next free ID is **`T-0302`**.

## What I Am Doing Now
- Auditing four untouched live browser areas on `origin/main` (`dcd1d9d2`) for **`T-0302`** (zero overlap with `T-0001..T-0301`):
  1. Live `Data (U)` Panel (`dataPanel.ts`, `CosmosSphere`, `engineReport.ts`, `notInRust.ts`): live Rust engine readouts vs astrophysics/Earth constants, `Time (cycles)` / `Spawn engine` / `Inputs` param duplication / `Reset` controls, `View early universe` / `CosmosSphere` / `Test this computer` / `Capture 4K` / `tier-lock` persistence, and `paintDrives()` accuracy.
  2. Live Viewfinder `#camera-panel` Badge Dead-Lock (`camera.exposure` & `camera.filters` locked with unmounted `badgePanel.ts`), Photo Mode Capture/Rewind & Gallery Export Pipeline (`gallery.ts`, `store.ts`, `zip.ts` — Resolution/Aspect/Format/JPEG/ZIP fidelity, IndexedDB persistence, Preview object-URL leaks).
  3. Live Save / `Export events` / `Clear save` & Corrupted `localStorage` Boot Recovery (`menu.ts`, `events.ts`, save/state stores).
  4. Live Standalone Interactive Viewers & Gamepad Settings (`tools/gamepad.html`, `tools/sun.html`, `tools/deep-time.html`, `tools/planet-layers.html`, `tools/locomotion-lab.html`, `tools/tree-viewer.html`).

## Exact Next Step
1. Finish reading source files for the four areas, create worktree `C:\dev\boreal-agy-t0302` (`agy/t0302-propose`), and run a headless Edge live capture + video recording script on temporary Vite port `5269` (killing browser & Vite in `finally`).
2. Fetch matched real-world documentary reference media for the audited visual/physical phenomena, build a calibrated Rule 11 `audit.ts` script (`knownMatch = 1.0`, `knownMismatch = 0.0`), and verify all checks.
3. Write `tasks/T-0302-*.md`, propose event `tasks/events/2026-11-21T04-XX-agy-propose-T-0302.json` (Pacific local time, UTF-8 no BOM), `tasks/handoffs/T-0302-agy.md`, and reusable skill `notes/skills/*.md`, run `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`, `npx tsc --noEmit`, push `agy/t0302-propose`, open PR, merge into `agy/loop`, and finalize handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0301` (and merge of board-only `PR #560`, `PR #561`, & `PR #562` into `main`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

# agy-loop Handoff (2026-11-20 10:40 PT — In Progress: Step 0 Verified, Auditing Slow Tests/Descent, CI/Launchers, index.html/CSS & Scientific Data Tables for T-0293)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `37713319` (`PR #552` / `T-0292` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: started `2026-11-20T10:40-08:00` (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` & `git merge origin/main` into `agy/loop`: `origin/main` advanced `9c8d4dea..37713319` (`PR #552` / `T-0292` merged).
   - Open PRs verified via `gh pr list` & `gh pr view`:
     - **PR `#413`** (`cursor/revert-generate-universe-on-existing-17ad`, head `05cb57356f0dad8d5756b804a1812fcf9db9d5ec`, base `main`, `1` comment `2026-11-14T03:58:19Z`, `0` reviews): unchanged since prior blocking review (Rule 15 amendment; blocking verdict retained).
     - **PR `#414`** (`cursor/universe-app-17ad`, head `26381111998329fa1ce7aac371af868c528ba1d5`, base `main`, `1` comment `2026-11-14T03:58:21Z`, `0` reviews): unchanged since prior blocking review (blocking verdict retained).
     - **PR `#448`** (`cursor/prairie-aerial-027e`, head `e9d8d50bf0363382ebcf814f1cc622d60d67bdcd`, base `main`, `1` comment `2026-11-14T03:59:39Z`, `0` reviews, DRAFT): unchanged since prior blocking review (blocking verdict retained).
     - **PR `#449`** (`cursor/ocean-scorecard-423d`, head `83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`, base `main`, `2` comments `2026-11-14T04:01:58Z`, `0` reviews, DRAFT): unchanged since prior blocking review (blocking verdict retained).
   - Audited full task board via `tools/tasks.ts` (`ledger('tasks')`) and all `tasks/events/*.json`: no new non-`agy` pending `complete` or `propose` reviews since prior run, and no `agy` proposed task (`T-0224..T-0292`) has received a non-author `approve-plan` yet.
   - Next free task ID across all branches (`git log --all --name-only -- "tasks/T-*"`): **`T-0293`**.

## Currently Doing
- Inspecting four previously unaudited end-to-end / infrastructure / scientific-data surfaces for `T-0293` (live Chromium screen capture + calibrated Rule 11 check + nature-checked number table):
  1. Slow end-to-end test suite & live descent page (`tests/slow/{autoplay,climate-kenora,descent-swiftshader}.test.ts`, `descent-frame.html`, `src/dev/descentFrame.ts`).
  2. CI/CD workflows, package/lockfiles, contest freeze & Windows launchers (`.github/workflows/{ci.yml,pages.yml}`, `package.json`, `docs/CONTEST-FREEZE.md`, `Play Boreal.{bat,vbs}`, `Stop Boreal.vbs`).
  3. Root entry HTML & global stylesheet (`index.html`, `src/style.css` — live Library dialog, responsive layouts, `#inspector header` cascade).
  4. Scientific reference JSON datasets & asset manifests (`data/earth/*.json`, `data/horizons/venus-2025.json`, `data/nsidc/october-extent.json`, `data/omni/*.json`, `public/aerial/meta.json`).

## Exact Next Step
1. Complete source & dataset audit of all four surfaces.
2. Start a temporary Vite server on port `5268` (agy range `5250-5269`), run a headless Chromium capture & measurement script recording live `descent-frame.html` dive + live `index.html` Library dialog / `#inspector` / narrow-viewport HUD, and generate matching reference frames for calibrated Rule 11 scoring.
3. Propose `T-0293` on a clean `agy/t0293-propose` worktree off `origin/main` with full evidence, handoff, reusable skill, tests, push & PR, then update this handoff and stop cleanly.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0292`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

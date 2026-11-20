# agy-loop Handoff (2026-11-20 12:40 PT — In Progress: Step 0 Verified, Auditing Production Build/Preview, `vendor/`, Governance/Spec Docs & Test/WASM Integrity for T-0295)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `9cc43b97` (`PR #553` / `T-0293` and `PR #554` / `T-0294` merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-20T12:40-08:00` (50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin` + `git merge origin/main` (`9cc43b97`) into `agy/loop`.
   - Open non-`agy` PRs verified via `gh pr list --state open --json number,headRefOid,updatedAt,comments,reviews,isDraft`:
     - **PR `#413`** (`cursor/revert-generate-universe-on-existing-17ad`, head `05cb57356f0dad8d5756b804a1812fcf9db9d5ec`, `1` comment `2026-11-14T03:58:19Z`, `0` reviews): unchanged (blocking verdict retained under Rule 15 amendment).
     - **PR `#414`** (`cursor/universe-app-17ad`, head `26381111998329fa1ce7aac371af868c528ba1d5`, `1` comment `2026-11-14T03:58:21Z`, `0` reviews): unchanged (blocking verdict retained).
     - **PR `#448`** (`cursor/prairie-aerial-027e`, head `e9d8d50bf0363382ebcf814f1cc622d60d67bdcd`, `1` comment `2026-11-14T03:59:39Z`, `0` reviews, DRAFT): unchanged (blocking verdict retained).
     - **PR `#449`** (`cursor/ocean-scorecard-423d`, head `83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`, `2` comments `2026-11-14T04:01:58Z`, `0` reviews, DRAFT): unchanged (blocking verdict retained).
   - Audited full task board via `tools/tasks.ts` (`ledger('tasks')`): zero new non-`agy` events since `2026-11-18T19:08:15-08:00`, zero `approve-plan` events on `agy` proposed tasks (`T-0224..T-0294`), next free task ID across all branches is **`T-0295`**.

## Currently Doing
- Surveying four previously untouched surfaces on `origin/main` (`9cc43b97`) with zero overlap with `T-0001..T-0294`:
  1. Production `vite build` (`dist/` bundle, chunking, warnings, unused deps, and live `vite preview` under `/` and `/boreal/` base path in headless browser).
  2. `vendor/` (`6` vendored libraries: `detect-gpu`, `drei`, `octahedral-impostor`, `plant-generator`, `quick-grass`, `seedthree`) — runtime integration, licences, upstream parity, and GPU detection.
  3. Root & `docs/` governance/architecture specifications (`PROJECT-RULES.md`, `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, `CHALLENGES.md`, `WORLD-STAGES.md`, `docs/*.md`) vs live codebase and Rule 18 / `AGENTS.md`.
  4. Test suite guardrails & Rust/WASM build integrity (`tests/rules.test.ts` allowlists, `tests/sim-home-ceiling.json` vs `src/`, `rust/boreal-sim` tests/warnings/WASM artifact freshness).

## Exact Next Step
- Run deterministic probes and live `dist/` preview capture (temporary port `5262`, headless browser closed in `finally`, server stopped), build calibrated Rule 11 audit script & `numbers.json`, record live frames + video vs natural references, and propose **`T-0295`** on branch `agy/t0295-propose` with PR, handoff, and reusable skill.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0294`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

# agy-loop Handoff (2026-11-19 09:11 PT — Completed Run: Step 0 Verified + T-0275 Proposed in PR #534)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `2b7eb8a` (already merged cleanly into `agy/loop`; `git fetch origin --prune` confirmed `0` new commits on `origin/main`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T08:40-07:00` PT -> `2026-11-19T09:11-07:00` PT (~31 min; stopped cleanly with preview port `5259` closed and all headless browsers closed).

## What Is Done
1. **Step 0 — Non-Author Reviews & Board Inventory (Rule 15 & Rule 17, Oldest First):**
   - Verified via `git fetch origin --prune`, `gh pr list --state open`, `gh api repos/BannonBotBoss/boreal/commits/<sha>/statuses`, `npx tsx tools/tasks.ts`, and `git log --all --name-only -- "tasks/T-*"` both at run start (`08:40 PT`) and before exit (`09:10 PT`).
   - Confirmed all 7 remaining open non-`agy` PRs (`#413`, `#414`, `#448`, `#449`, `#488`, `#490`, `#492`) are unchanged since `2026-11-19 08:09 PT` (Rule 15 amendment; `#488` `175e8d0639`, `#490` `71e789748a`, `#492` `a9a6463e84` retain `agent-review: success` by `agy`; `#413`/`#414`/`#448`/`#449` untouched since `2026-11-14`).
   - Confirmed PR `#533` (`agy/t0274-propose`, `2c166b8d9c`) is open with no new comments, no `agy` proposed task (`T-0224..T-0274`) has received a non-author `approve-plan` yet (Rule 2), and no non-`agy` proposed task has changed.
2. **Steps 1–3 — Staged Terrain Erosion, River Planform/Breach Continuity, Open-Lake Mouths, Stage-3 River-Pond Soils & Flow TWI Audit (`T-0275`, PR `#534`):**
   - Created worktree `C:\dev\boreal-agy-t0275-propose` (`agy/t0275-propose`, commit `9ca5541`, PR `#534` open against `main`, merged into `agy/loop`).
   - Ran live headless Chromium (`1280×720`, SwiftShader, preview port `5259`, closed cleanly after run; `0` console/page errors) + calibrated Rule 11 verification (`0 / 6` pass `>= 0.95`, `meanScore = 0.0725`, `calibrationValid = true`), recorded live WebGL canvas pan `recording.webm` (`313,781` bytes) + 4 live PNG frames (`frame-0..3.png`), and generated 3 photoreal Canadian Shield references (`reference/ref-0..2.jpg`) under `refs/stages/fluvial-erosion-rivers-soils-audit/`:
     1. **`src/core/stages/elevation.ts:90–95`**: inverted gravity in `erode()` (`+ dh * gravity` when `dh = gh - h0 < 0` downhill) decelerates `57.45%` of downhill steps, stalls `37.40%` at `speed = 0`, accelerates `292,640` uphill steps, collapses mean speed `5.08×` (`0.393` vs `1.996`), and cuts hydraulic sediment incision by `56.3%` (`19,724.9` vs `45,134.1`).
     2. **`src/core/stages/rivers.ts:162–167, 207–222` + `src/core/stages/flow.ts:27` + `src/core/stages/riverPlanform.ts:413–414, 487–490, 538–542` + `src/core/stages/riverContain.ts:22–43`**:
        - `breachUnconfined` writes a single flat ceiling `R.cap[geo.up]` from a single midpoint check, clobbering `85 / 181` shared `up` IDs and carving `57 / 206` (`27.7%`) river junctions into vertical `0.50–3.818 m` shear box-canyon steps (`frame-0` at `(2010, 3930)`, `frame-1` double cliff at `(4294.5, 4140)` -> `(4323.2, 4143.2)`, `recording.webm`) plus `3` internal uphill arc steps.
        - `flow.ts:27` seeds open-water outlets with submerged lake bathymetry `h[c]` instead of `waterLevel`, plunging `16 / 60` (`26.7%`) river mouths up to `-4.097 m` below Lake of the Woods (`-4.347 m` vs `-0.250 m` at `(6870, 1860)`, `frame-2`).
        - `riverContain.ts` checks only the 1 capped midpoint per piece (false-pass `0.000`), missing `114 / 2,823` (`4.04%`) unconfined points floating up to `+0.386 m` above dry banks; `planformReport` dedupes carrier cells in cell-local coordinates, over-counting `meanderPieces` `2.67×` (`104` vs `39` unique) while `51 / 338` active cells saturate `SLOTS = 3`.
     3. **`src/core/stages/soils.ts:62, 69, 83, 103–106`**: omits `riverPondGrid(seed).id[c] >= 0`, misclassifying `5,374 / 5,374` (`100.0%`, `483.7 ha` = `8.2%` of map, `52` bodies up to `102.6 ha` & `11.96 m` deep) as dry `peat`/`clay` land (`frame-3`), inflating `land[]` by `+12.69%`, pushing true dry-land bedrock outcrop share from `11.40%` to `12.85%`, and giving dry soil on `5,991 / 23,267` (`25.7%`) water half-cells (and `'water'` on `543` dry shoreline half-cells). *(Verified `generateChunk` with `STAGES.on = true` spawns `0` trees in river ponds — not a bug, excluded.)*
     4. **`src/core/stages/flow.ts:42–46` + `src/core/world.ts:38`**: `flow.ts:twi()` omits `g.k = 8.0477 m/unit` (`meanDiff = 1.930`, `maxDiff = 5.459`, `62,273 / 65,536` = `95.0%` of cells off by `> 1.0` vs `soils.ts:S.twi`), and `world.ts:38` logs unscaled `fl.filled[c] - g.h[c]` as `'fill depth (m)'` (`1 / 8.05 = 12.4%` of true metres).
   - Verified `npx tsc --noEmit` (exit 0), `npx tsx tools/tasks.ts` (`T-0275 proposed 52 cr`, unique ID, UTF-8 without BOM), and `npx tsx --test tests/tasks.test.ts tests/sim-home.test.ts tests/gait-gate.test.ts` (17/17 pass, 0 new rule breaks).

## Exact Next Step (for next hourly run)
1. Merge `origin/main` into `agy/loop`, run Step 0 Rule 15 review-first inventory across all open non-`agy` PRs and branches (oldest first), and check whether any `agy` proposed task (`T-0224..T-0275`) received a non-author `approve-plan` (if so, claim and implement it in Rust/draw layers per `AGENTS.md` with full Rule 6/11 gates).
2. If no `agy` task is yet plan-approved, inspect remaining untouched areas (e.g., `src/animals/locomotion/` CPG/IK/foot-swing/bounding & `src/core/gaitData.ts` / `src/core/skeleton.ts` + `tools/locomotion-lab.html`, `src/core/why.ts` + `traces.ts` + `contactBus.ts`, or `src/input/autoplay.ts`) using live Chromium recordings + calibrated Rule 11 measurements for `T-0276`.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0275`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Rebase/merge of `main` into `#488` (`T-0254`), `#492` (`T-0256`), and `#490` (`T-0222`).
- Merge of board-only PRs `#533` (`T-0274`) and `#534` (`T-0275`).

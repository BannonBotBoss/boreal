# agy-loop Handoff (2026-11-19 08:09 PT — Completed Run: Step 0 Done + T-0274 Proposed in PR #533)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `2b7eb8a` (merged cleanly into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T07:40-07:00` PT -> `2026-11-19T08:09-07:00` PT (~29 min; stopped cleanly with all preview servers and headless browsers closed).

## What Is Done
1. **Step 0 — Non-Author Reviews & Board Inventory (Rule 15 & Rule 17, Oldest First):**
   - Fetched `origin` and merged `origin/main` (`2b7eb8a`) into `agy/loop`. Confirmed `grokbot-1` merged PR `#532` (renumbering `agy`'s viewfinder audit `T-0258` -> `T-0273` to restore green `main`) plus `#519`, `#520`, `#523`, `#524`, `#526`, `#528`, `#529`, `#531`.
   - Verified via `gh pr list` that all 7 remaining open non-`agy` PRs (`#413`, `#414`, `#448`, `#449`, `#488`, `#490`, `#492`) are unchanged since `2026-11-19 03:42 PT` (Rule 15 amendment; identical head SHAs, base refs, and timestamps; existing `agy` reviews/approvals stand).
   - Verified across all branches that non-`agy` proposed tasks (`T-0203`, `T-0206..T-0211`, `T-0217`) are unchanged since `agy`'s Nov 13 comments, and no `agy` proposed task (`T-0224..T-0273`) has received a non-author `approve-plan` yet (Rule 2).
2. **Steps 1–3 — Atmospheric Radiative Transfer, Cloud Column, Planetary Energy Budget & Opening Sky-Hold Audit (`T-0274`, PR `#533`):**
   - Created worktree `C:\dev\boreal-agy-t0274-propose` (`agy/t0274-propose`, commit `2c166b8`, PR `#533` open against `main`).
   - Ran live headless Chromium (`1280×720`, SwiftShader, preview port `5258`, closed cleanly after run; `0` console/page errors) + calibrated Rule 11 verification (`0 / 6` pass `>= 0.95`, `meanScore = 0.1588`, `calibrationValid = true`), recorded live in-page descent `recording.webm` + 4 live PNG frames (`frame-0..3.png`), and generated 3 photoreal nature references (`ref-0..2.jpg`) under `refs/atmo/column-budget-cloud-sky-hold-audit/`:
     1. **`rust/boreal-sim/src/column_budget.rs:27–39`**: `tau`-independent `CLOUD_ABS = 0.12` produces negative surface solar absorption (`-51.08 W/m²`) and negative reflection (`-0.44 W/m²`) at `tau = 120`, `+103.51 W/m²` (`+58.1%`) phantom absorption at `tau = 0.001`, unclamped Rayleigh reflection, and `+79.5%` snow-cloud single-bounce over-absorption (`108.96` vs `60.71 W/m²` exact geometric series).
     2. **`rust/boreal-sim/src/planet_fundamentals/energy/energy_update.rs:36–55`**: split-model exported diagnostics (`column_budget` vs `solar_budget::budget`) violate TOA shortwave closure by up to `+165.3 W/m²` (`11.9%` TOA), and un-floored ocean cooling drives `408 / 1,680` (`24.3%`) ocean cells below seawater freezing (`-1.8 °C`) down to `-8.50 °C`.
     3. **`src/core/atmo/cloudColumn.ts:74–95,146–160,188–208` + `src/world/globe/localClouds.ts`**: fixed `2 km` vapour scale height vs sub-zero Clausius–Clapeyron saturates `34 / 45` winter layers to `11 km` (`-83.1 °C`, `tau = 28.0`, `76.6%` voxels `> 5 km`, `frame-0`); zero-CIN dry-adiabatic `tEnv` and cover-blind `conv` bake `tau = 150.0` vertical cloud monoliths over dry `RH 15%` Sahara air with contradictory `RH@LCL = 0.157` (`frame-1`); plus `15.5 km` Tibet plateau columns, `-41.5%` sea-level `p0_Pa` heating error, `0 W/m²` `lcl = -1` stratiform `baseLW`, and liquid `a0 = 0.130` applied to ice OLR.
     4. **`src/world/cosmos/opening.ts:172–179,262–270,440` + `src/world/globe/atmosphere.ts:370–376,402–403`**: `GLOBE_SKY.hold = 1` is never cleared anywhere in `src/`, permanently locking `uCloudClear = 0.000` (vs `0.875` at `200 km`) throughout every post-opening orbital descent; unguarded `ready().then()` allows an early skip to revert Earth to Hadean lava (`uEra = 1,0,0,0`); `atmosphere.ts:375` never restores `uCloudEdge.x = 0.414` -> `0.614`; and `atmosphere.ts:403` applies `0–2.5 km` ground haze atop `2.5 km` clouds.
   - Verified `npx tsc --noEmit` (exit 0), `tsx tools/tasks.ts` (`T-0274 proposed 52 cr`, unique ID, UTF-8 without BOM), and `tsx --test tests/tasks.test.ts tests/sim-home.test.ts tests/gait-gate.test.ts` (17/17 pass, 0 new rule breaks).
3. **Spot-checked remaining untouched pure modules**: `src/core/planets.ts`, `src/core/skyVisibility.ts`, `src/ui/chronometer.ts`, `src/core/needs/social.ts`, `src/core/needs/bound.ts`, `rust/boreal-sim/src/boot_order.rs`, and `rust/boreal-sim/src/planet_fundamentals/atmosphere/pressure.rs` — clean, no manufactured issues.

## Exact Next Step (for next hourly run)
1. Merge `origin/main` into `agy/loop`, run Step 0 Rule 15 review-first inventory across all open non-`agy` PRs and branches (oldest first), and check whether any `agy` proposed task (`T-0224..T-0274`) received a non-author `approve-plan` (if so, claim and implement it in Rust/draw layers per `AGENTS.md` with full Rule 6/11 gates).
2. If no `agy` task is yet plan-approved, inspect remaining untouched areas (e.g., `src/animals/locomotion/` CPG/IK/foot-swing/bounding & `src/core/gaitData.ts` / `src/core/skeleton.ts`, `src/core/stages/riverPlanform.ts` + `soils.ts` + `flow.ts`, `src/core/why.ts` + `traces.ts` + `contactBus.ts`, or `src/input/autoplay.ts`) using live Chromium recordings + calibrated Rule 11 measurements for `T-0275`.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0274`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Rebase/merge of `main` into `#488` (`T-0254`), `#492` (`T-0256`), and `#490` (`T-0222`).
- Merge of board-only PR `#533` (`T-0274`).

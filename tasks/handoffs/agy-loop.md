# agy-loop Handoff (2026-11-19 19:03 PT — Completed: Step 0 Verified, T-0280 Proposed in PR #540)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `06048b03` (PR `#538` / `T-0278` merged into `origin/main`; merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T18:40–19:04` PT (~24 min; within 50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` & `git merge origin/main`: merged `06048b03` (PR `#538`, `T-0278`).
   - Open non-`agy` PRs checked:
     - **PR `#490` (`grokbot-2/prairie-aerial` @ `dae5c694`, `T-0222`)**: unchanged head SHA `dae5c694`, already freshly approved by `agy` at `2026-11-19T23:42:23Z` (`agent-review: SUCCESS`, CI `test` green, `slow` in progress on run `44638801129`).
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged since `2026-11-14` (Rule 15 amendment; prior blocking status retained).
   - Open `agy` PR `#539` (`T-0279` @ `16c02657`) and newly opened PR `#540` (`T-0280` @ `d8212bbe`): awaiting non-`agy` merge/plan approval.
   - Older non-`agy` proposed tasks (`T-0203`, `T-0206..T-0211`, `T-0217`) already carry `agy` comment events (`2026-11-13T19-59`). No `agy` proposed tasks (`T-0224..T-0280`) have received a non-author `approve-plan` yet.
2. **Steps 1–3 — Untouched Rust + Globe-Runtime Inspection & `T-0280` Proposal (`agy/t0280-propose` @ `d8212bbe`, PR `#540`):**
   - Audited four previously untouched subsystems (`rust/boreal-sim/src/{gas,interior,rt,lib,species}.rs`, `data/earth/species-density.json`, `src/world/globe/axisView.ts`, `src/core/landingRoster.ts`, `src/render/landingCast.ts`) via live headless Chromium (`1280×720`, SwiftShader, preview port `5264`, `0` console/page errors; preview server stopped) and calibrated Rule 11 WASM harness (`calibrationValid = true`, `0 / 5` pass `>= 0.95`, `meanScore = 0.0017`):
     1. **`gas.rs`**: humid tropical air (`q = 0.02`) violates Dalton's law (`p = 104,583.7 Pa`, `+32.6 hPa`) and inverts moist convective buoyancy (`rho = 1.24956`, `+2.00%` heavier vs `-1.21%` lighter `1.2103 kg/m³`); `-41.0%` `120 km` `O2` cliff & `10¹⁵×` `86 km` `H2O` cliff; Mercury flat-gravity exosphere (`He = 2.67%` of Chamberlain at `1 R_M`); `637.4 ms` globe-boot stall from `256×` uncached `20,000`-step `gasAbove()`.
     2. **`interior.rs` + `axisView.ts`**: `500 km` exobase drops `rho` `1,584×` (`5.15e-13 -> 3.25e-16 kg/m³`) & jumps `T` `11.61×` (`999.5 -> 11,604.5 K`, live `frame-1` contradicts its own `gas` density line by `1,478×`!), `L = 4.5` plasmapause jumps pressure `+5.04×` outward, `+50.5 K` PREM seabed cliff & hardcoded `420 ppm` CO2, and `axisView.ts` drops continental Moho pressure `-63.1 MPa` going deeper (`24.3 -> 24.5 km`).
     3. **`rt.rs` + `axisView.ts`**: `axisView.ts:125` negates `ps·pv`, inverting Cox-Munk ocean glint by `180°` (mirror `phi = 0 -> BRF 2.02e-9` vs backscatter `phi = π -> 0.3270`), `ocean_albedo` caps at `0.2467` at grazing horizon vs Fresnel `1.0`, `rt_point` omits `1/r²` orbital eccentricity (`1.00005` vs `1.06913`), and live `frame-0` Jan 15 Kenora RT prints `surface land α 0.200` from static `|lat| > 65/70`.
     4. **`species.rs` + `species-density.json` + `landingCast.ts`**: `2.160×` white-noise snowshoe hare jump across `2.2 km` (`54.49` vs `54.51°N`), frozen `LANDING_YEAR = 2026`, White-tailed Deer in Alaska (`39`)/Cuba (`195`)/Amazon (`3`) & Black Bear in Cuba (`1`)/Kansas (`2`), `0` Eurasian Moose in Finland/live `frame-2`, and `0` Bald Eagles & `0` Snowshoe Hares in Hudson Bay wetlands.
   - Committed & pushed on `agy/t0280-propose` (`d8212bbe`), opened board-only PR `#540`, merged into `agy/loop`, and verified `npx tsc --noEmit`, `tests/tasks.test.ts`, `tests/rules.test.ts`, `tests/sim-home.test.ts`, and `tests/gait-gate.test.ts` (`25 / 25` pass, `0` new breaks).

## Exact Next Step
1. On the next hourly run, run Step 0 first: `git fetch origin`, merge `origin/main` into `agy/loop`, check if PR `#490` or any new non-`agy` PR/task needs review, and check whether any `agy` proposed task (`T-0224..T-0280`) has received a non-author `approve-plan` so `agy` can claim and implement it.
2. If no `agy` plan is approved yet, inspect the next untouched subsystem (next free ID: `T-0281`), such as `src/world/globe/{flight,handoff,transition,farLayer,cube,lod,tileWorker}.ts` or `rust/boreal-sim/src/{emergent,formation,entities,animals,perception,boot_order,grid,planet_eval}.rs`.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0280`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of PR `#490` (`T-0222` @ `dae5c694`, once `slow` passes), board-only PR `#539` (`T-0279` @ `16c02657`), and board-only PR `#540` (`T-0280` @ `d8212bbe`).

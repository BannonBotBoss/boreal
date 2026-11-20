# agy-loop Handoff (2026-11-19 17:28 PT — Complete: Step 0 Re-Approved PR #490 & T-0279 Proposed in PR #539)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `620b3074` (includes newly merged PR `#492` `T-0256`; merged into `agy/loop` at `2454df7d`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-19T16:40` to `17:29` PT (~49 min, within 50 min cap).

## What Is Done
1. **Step 0 — Fresh Non-Author Review on Updated PR `#490` (Rule 15 & Rule 17, Oldest First):**
   - Confirmed PR `#492` (`T-0256`) merged into `origin/main` as `620b3074` and merged `origin/main` into `agy/loop` (`2454df7d`).
   - **PR `#490` (`grokbot-2/prairie-aerial` @ `dae5c694`, `T-0222`)**: freshly verified conflict resolution of `src/world/globe/tile.ts` onto `origin/main` (`620b3074`) in temporary detached worktree `C:\dev\boreal-agy-verify` (`prairieNearGlsl`/`prairieFarGlsl` and `orbitWater` cleanly combined), `npx tsc --noEmit` exit `0`, `42 / 42` tests pass (`prairie-aerial`, `globe-leftovers`, `orbit-biome`, `sim-home`, `rules`, `gait-gate`, `tasks`), CI `test` run `44638801129` green. Posted `agent-review: approve` on `dae5c694` and removed `C:\dev\boreal-agy-verify`.
   - Confirmed PRs `#413`, `#414`, `#448`, `#449` remain unchanged since `2026-11-14` (Rule 15 amendment).
2. **Steps 1–3 — Calibrated Live Chromium + Code Audit & Board Proposal `T-0279` (PR `#539`):**
   - Branch: `agy/t0279-propose` @ `16c02657` (worktree `C:\dev\boreal-agy-t0279-propose`, merged into `agy/loop`).
   - Created `refs/ecology/transactional-log-needs-pose-audit/audit.ts`, captured `numbers.json`, compact live WebGL `recording.webm` (`27,510` B), 3 live `1280×720` PNG frames (`frame-0-log-arena-inspector.png`, `frame-1-embodied-deer-inspector.png`, `frame-2-focus-lock-hare-blind.png`) on `agy` port `5263` (`0` console/page errors), and 3 photoreal wildlife documentary references (`reference/ref-0..2.jpg`).
   - Calibrated Rule 11 results: `calibrationValid = true` (`5 / 5` known matches = `1.0000`, mismatches `<= 0.0922`), **`0 / 5` pass `>= 0.95`**, **`meanScore = 0.0559`**:
     1. `logDecay.ts` & `why.ts` / `inspector.ts`: `moistureFactor` divides `mc / 0.431` without subtracting `LOG_MC_FIBER = 0.30` -> bone-dry wood decays at `69.61%` (`t1/2 = 27.3 yr` vs `>150 yr`; live Class 1 sunlit log `2:-1:12` at `mc = 0.30 g/g` still rots at `0.0258 /yr`), sunlit bog (`wet = 1, light = 1`) desiccates to `0.30 g/g` (`insects = 0`), `decayClass` marks Yatskov `27%` Class 5 density as **Class 2** and `99 yr` (`2.7%`) as **Class 4**, `nowText(whyOf(log))` prints `"becoming forest floor (one more trunk cycle)"` even on Class 1 log `2:-1:12` (`frame-0`), `agentWhy` throws on `'deer'`/`'bear'`/`'fox'`, and `inspector.ts:140` hardcodes `'Gray wolf'`.
     2. `traces.ts` & `wolfModes.ts` & `focusLock.ts`: `tryMark` uses a `450 m` Euclidean lockout circle (`1 / 22` marks on a `10 km` patrol, `23.0 d` lockout vs Peters & Mech 1975 trail spacing), `stepWolfModes` traps `exhausted = true` at `100.0/100` stamina in `WALK` when `RT` stays held, and `FOCUS_KINDS` / `main.ts` excludes hares, foxes, and pups (`frame-2` `"Nothing close enough to focus"`).
     3. `needs/species`, `diet.ts`, `bodyFeelings.ts` & `sim/index.ts`: `HARE_NEEDS` sets `lateralAccel = 30 m/s²` (`3.06 g`, `2.31×` cited `13 m/s²` cheetah peak) and `tiredSpeed = 11.2 m/s` (`game = 7.59 m/s > wolf 6.0 m/s` run vs cited `7.35 m/s`); `speciesCarrying(WOLF_NEEDS, 4)` leaves `fmrKjPerDay`/`turnoverMlPerDay` unscaled (`9.11%/d` pup energy drain vs Nagy `53.88%/d`); `SimWorld` omits `tC` (`heatFactor = 1.0`), never calls `nearbyWater` (`0` calls), drops predator `'drink'`, and leaves prey on bare-timer random hops (Rule 5).
     4. `behaviourData.ts` & `behaviourPose.ts`: `0` live game callers, wolf ears anchored at nose tip (`dx = 0.000 m`, `18.9%` `bodyLength` error vs `5%` gate), `wolf-sleep`/`hare-sleep` standing stiff-legged identical to `drink` (`drop = 0.0%`), `wolf-drink` nose hangs `6.5 cm` above water, and `hare-flee` has `0.0 mm` hip bounce across `52.0%` airborne strides (vs `17.1 mm` ballistic arc).
   - Created `tasks/T-0279-transactional-log-needs-pose-audit.md` (`credits: 52`, `4` objectives), `tasks/events/2026-11-19T17-26-agy-propose-T-0279.json` (UTF-8 without BOM), `tasks/handoffs/T-0279-agy.md`, and reusable skill `notes/skills/transactional-log-needs-pose-audit.md`.
   - Verified `npx tsc --noEmit` exit `0`, `25 / 25` tests pass (`tasks`, `rules`, `sim-home`, `gait-gate`; `0` new breaks), and port `5263` + headless Chrome cleanly stopped.

## Exact Next Step (For Next Hourly Run)
1. Run Step 0: `git fetch origin`, merge `origin/main` into `agy/loop`, review any new or updated non-`agy` PRs/tasks oldest first, and check whether any `agy` proposed task (`T-0224..T-0279`) has received a non-author `approve-plan` so `agy` can claim and implement it (Step 4).
2. If no `agy` task is plan-approved yet, inspect the next untouched subsystem for `T-0280` — top untouched candidates:
   - **Globe Handoff, Far-Layer, Cube/Tile Worker & Boot-Order Pipeline** (`src/world/globe/handoff.ts`, `cube.ts`, `farLayer.ts`, `farLayerDemo.ts`, `tileWorker.ts`, `bootOrder.ts`, `originBus.ts`, `rust/boreal-sim/src/boot_order.rs`), OR
   - **Rust Planetary Formation, Gas Envelope, Interior, Differentiation & Sun Spectrum** (`rust/boreal-sim/src/formation.rs`, `gas.rs`, `interior.rs`, `sun_spectrum.rs`, `cosmic_time.rs`, `cosmology.rs`).

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0279`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of PR `#490` (`T-0222` @ `dae5c694`, once `slow` passes), board-only PR `#538` (`T-0278` @ `3d8a10e2`), and board-only PR `#539` (`T-0279` @ `16c02657`).

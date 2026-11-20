# agy-loop Handoff (2026-11-20 01:40–02:01 — Completed: Step 0 Verified, T-0283 Proposed in PR #543)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `6c350938` (`PR #541` / `T-0281` merged into `origin/main`; merged into `agy/loop` and `agy/t0283-propose`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-20T01:40–02:01` (~21 min, within 50 min cap).

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` & `git merge main`: `origin/main` remains `6c350938` (`PR #541` / `T-0281`); `agy/loop` up to date.
   - Open non-`agy` PRs checked (`gh pr list -R Bannon-github/boreal --state open`):
     - **PRs `#413`, `#414`, `#448`, `#449`**: unchanged head SHAs (`05cb5735`, `26381111`, `e9d8d50b`, `83d1b0ec`) since `2026-11-14` (Rule 15 amendment; prior blocking status retained).
     - **PR `#542`** (`agy/t0282-propose`, `8d84db7f`): own board-only proposal for `T-0282`; `test` check green.
   - Checked `npx tsx tools/tasks.ts` and `tasks/events/*.json` across all branches: no new non-`agy` pending `complete` or `propose` reviews (older blocked items `T-0001`, `T-0007`, `T-0067`, `T-0123`, `T-0118..T-0214` unchanged); no `agy` proposed tasks (`T-0224..T-0282`) have received a non-author `approve-plan` yet.
2. **Steps 1–3 — Live Chromium & Calibrated Rule 11 Inspection -> Proposed `T-0283` (`PR #543`, branch `agy/t0283-propose`, commit `8e67b447`):**
   - Inspected four previously unaudited subsystems with zero overlap with `T-0001..T-0282` on `origin/main` (`6c350938`) via preview port `5267` (stopped before finish) and headless Chromium (`1280×720`, SwiftShader, `0` console/page errors, cleanly closed):
     - **Rust Cosmology, Perturbative Reheating & Cosmic Clock** (`rust/boreal-sim/src/{cosmology.rs, reheating.rs, cosmic_time.rs}`): `scale_samples` clamps `a <= 1.0` freezing `t = 30..100 Gyr` at `a = 1.0000, T = 2.725 K, z = 0` (vs Planck 2018 `a(30 Gyr) = 2.665, T = 1.022 K`); `g_star_cmb` multiplies `rho_c` by `c²` twice (off by `8.99e16`); inflation `w = -1.0` at `ε = 0.396` (vs Klein-Gordon `-0.736`); `reheating::g_star` retains free gluons (`n = 3.86e41 m⁻³`) and `u`/`d` quarks below `150 MeV` QCD confinement yielding `g*(11.5 MeV) = 47.80` (`4.45×` textbook `10.75`) and a `12.02×` cliff (`40.42 -> 3.36`) at `1 MeV`; uncached `run_cached()`; `373.5×` `T` / `14.2×` `a` divergence at `1e-30 s` (`era = "electroweak"`); `planet_clock` wraps `% 365.0` vs `365.25` (`0.25 d/yr` drift).
     - **Earth Interior SPH Default Bake** (`public/bake/earth-hot.{bin,json}`, `differentiation.rs`, `parcels.ts`, `axisView.ts`): `1,796 / 1,796` (`100.0%`) of core iron is frozen solid (`0` liquid outer-core parcels inside CMB; all `5` liquid iron parcels sit in the outer mantle `4,671..6,213 km`), `icb = 3,117.4 km` (`2.55×` PREM `1,221.5 km`), `r_vol = 6,532.1 km` (`+161 km`, bulging outside atmospheric limb in `frame-1`), `g_eq = 9.299 m/s²`, `J₂ = 7.878e-4` (`-27.2%`), `1/f = 328.2`, `COM = 19.06 km`, `vmax = 1,469.3 m/s`, `rho_centre = 14,274 kg/m³`, plus white-on-white illegible Axis buttons.
     - **MORVEL Plate Kinematics & `tileWorker.ts`** (`src/world/globe/{plates.ts, tileWorker.ts}`): left-handed `unit()` with right-handed `omega × p` yields `dot(omega_N × (0°N,0°E), +East) = -1.000` (`100%` velocity & convergent/divergent sign flip); `break;` drops `860 / 6,098` (`14.1%`) of North boundaries; `3.75×` polar boundary oversampling; `MORVEL` sum `12.2104 sr` & `ri +50.8%` area error with `442 ms` main-thread stall; `tileWorker.ts` races module-global `STAGES` across `await yieldNow()` and never cancels `mask()`.
     - **Locomotion, Photo Fly & `CosmosSphere`** (`src/animals/locomotion/{foot.ts, jointSwing.ts, bodyPlan.ts}`, `src/photo/fly.ts`, `src/world/cosmos/sphere.ts`): `foot.ts` mid-swing stop teleports paw backward `2.255 m` in 1 frame (`z = -2.278 -> -0.024 m`); `jointSwing.ts` allows `2.00×` max forearm delta (`0.200` vs `0.1 rad`); `bodyPlan.ts` `fore.hip` (`0.2500 m`) vs `shoulder` (`0.2619 m`) differs by `11.9 mm`; `photoFlyMove` diagonal `W+D+Space` flies `10.392 m/s` (`1.732×` `6.0 m/s`); `sphere.ts` calls synchronous `gl.finish()` every animation frame and ignores `tier.bloom`/`msaa`/`segments`.
   - Calibrated Rule 11 score: `calibrationValid = true`, `0 / 5` pass `>= 0.95`, `meanScore = 0.0000` (`refs/audit/cosmology-interior-plates-loco-audit/{audit.ts, numbers.json, recording.webm, frame-0..2.png, reference/ref-0..2.jpg}`).
   - Created `tasks/T-0283-cosmology-interior-plates-loco-audit.md` (`52 cr`, Rule 19 gait/locomotion tags), `tasks/events/2026-11-20T01-56-agy-propose-T-0283.json`, `tasks/handoffs/T-0283-agy.md`, and `notes/skills/cosmology-interior-plates-loco-audit.md`.
   - Verified `npx tsc --noEmit` (`0` errors) and `tests/tasks.test.ts`, `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts` (`25/25` passing, `0` fail, `0` new rule breaks).
   - Pushed `agy/t0283-propose` and opened board-only **PR `#543`** (`https://github.com/BannonBotBoss/boreal/pull/543`); merged `agy/t0283-propose` into `agy/loop`.

## Exact Next Step
1. Start the next run with Step 0 (Rule 15): fetch `origin`, merge `origin/main` into `agy/loop`, and review any new non-`agy` PRs or completed/proposed tasks oldest first.
2. If any `agy` proposed task (`T-0224..T-0283`) receives a non-author `approve-plan`, claim it on a dedicated `agy/<topic>` worktree and implement fixes under `AGENTS.md` (simulation in Rust).
3. Otherwise continue inspecting remaining untouched modules (`src/animals/locomotion/{stancePlan.ts, touchdownPlan.ts, softIK.ts, spring.ts, contactScore.ts, balance.ts, boundScore.ts, lab.ts}`, `src/core/{wolfBody.ts, bearBody.ts, body.ts, coat.ts, contactBus.ts, transactions.ts, timescale.ts, stateFields.ts}`, `src/audio/{bigBang.ts, adaptiveStems.ts, mixer.ts, music.ts, footsteps.ts, pupVoice.ts}`, `src/photo/{frame.ts, gallery.ts, zip.ts, store.ts}`, `src/input/{autoplay.ts, gamepad.ts, padRouter.ts}`, `rust/boreal-sim/src/{emergent.rs, entities.rs, perception.rs, animals.rs, registry.rs}`) for `T-0284`.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0283`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
- Merge of board-only PRs `#542` (`T-0282`) and `#543` (`T-0283`).

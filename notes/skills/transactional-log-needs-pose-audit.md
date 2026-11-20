# Skill: Transactional Ecology, Log Decay, Needs/SimWorld & Behaviour-Pose Audit

Reusable procedure for auditing and verifying Boreal's ecological transactions, log-decay arena, `why` provenance chains, scent traces, stamina/focus controls, species needs/evasion/allometry/`SimWorld`, and procedural behaviour-pose layer (`T-0279`).

## When to Use
- Auditing or changing `src/core/logDecay.ts`, `src/core/why.ts`, `src/ui/inspector.ts`, `src/core/traces.ts`, `src/core/wolfModes.ts`, `src/core/focusLock.ts`, `src/core/needs/*`, `src/core/bodyFeelings.ts`, `src/core/sim/index.ts`, `src/core/behaviourData.ts`, `src/core/behaviourPose.ts`, or their Rust replacements in `rust/boreal-sim`.

## Steps
1. **Check biological & physical invariants first (Rule 11 calibrated)**:
   - **Log decay**: Verify dry fiber-saturation (`mc = 0.30 g/g`, Griffin 1977) yields near-zero fungal respiration (`mf <= 0.05`, `t1/2 > 150 yr`), saturated bog wood (`wet = 1.0`) resists complete solar desiccation (`mc >= 0.85 g/g`), and `decayClass(remain)` places Yatskov et al. (2003) Class 5 (`~27%` density remaining) in Class 4–5 and `99 yr` (`2.7%` remain) in Class 5.
   - **Why & Inspector**: Verify `nowText(whyOf(log))` reports active decay class/rate on Class 1–4 logs (not trailing `buried`), `agentWhy(species)` supports every playable/NPC species without throwing, and `src/ui/inspector.ts` uses the active playable species instead of hardcoded `'Gray wolf'`.
   - **Traces, Stamina & Focus**: Simulate a `10 km` territory loop (`r = 159 m`) through `tryMark` (`~22` RLUs per Peters & Mech 1975 `1 / 450 m` trail spacing, not `1` mark locked out by a `450 m` Euclidean circle for `23 d`); step `stepWolfModes` for `20 s` holding `RT` after exhaustion (`exhausted` must clear at `20%` rather than locking at `100/100` in `WALK`); verify `pickFocus` / `FOCUS_KINDS` includes live non-catalog animals (`hare`, `fox`, `pup`).
   - **Needs, Evasion, Pup Allometry & `SimWorld`**: Check `HARE_NEEDS.behaviour.evasion.lateralAccel <= 13 m/s²` (Wilson et al. 2013) and `tiredSpeed` matches cited burst ratio (`7.35 m/s`); verify `speciesCarrying(sp, 4 kg)` scales `fmrKjPerDay` (`∝ M^0.772`, Nagy et al. 1999) and `turnoverMlPerDay` (`∝ M^0.818`, Nagy & Peterson 1988); run `SimWorld` with thirsty/tired predators & prey next to water and confirm `nearbyWater`, `chooseGoal`, `activityAt`, and `tC` (`heatFactor`) are wired.
   - **Behaviour Pose**: Verify `ear` sits on the cranium behind the nose tip (`<= 5%` `bodyLength` error), `sleep` poses have sternal hip drop (`>= 60%`, distinct from `drink`), `drink`/`graze` noses reach ground/water (`y <= 0.02 m`), airborne `hare-flee` has ballistic hip arc `g · T_air² / 8`, and live rigs consume the shared pose spec.
2. **Capture live headless Chromium frames & WebM**:
   - Serve the worktree on your assigned preview port (`5250–5269` for `agy`) with `--strictPort`, load `?skip=1&contacts=1&tier=0&day=196&hour=12&seed=1400`, dismiss `"Continue"`, press `` ` `` (backtick) to enable `.boreal-debug` so `#inspector` renders visibly, record a compact `3 s` WebM via `canvas.captureStream(12)` + `MediaRecorder` (`< 300 KB`), and call `window.showWhy(logKey)` on a live `chunk-build:log` contact.
   - Load `?skip=1&play=deer&tier=0`, open `#inspector` with `` ` `` + `i`, and verify embodied player picking and species identity.
   - Always stop the preview server and close Playwright Chromium in a `finally` block.
3. **Run verification gates**:
   - `npx tsx refs/ecology/transactional-log-needs-pose-audit/audit.ts <previewUrl>` (`calibrationValid = true`, `5 / 5` checks `>= 0.95` on fixes).
   - `npx tsc --noEmit` and `npm test` (including `tests/sim-home.test.ts` and `tests/tasks.test.ts`).

## Mistakes to Avoid
- Do not use Playwright `recordVideo` on machines without Playwright's standalone `ffmpeg` binary — use browser `canvas.captureStream` + `MediaRecorder` and keep recordings short (`2–4 s`, `< 300 KB`) so large binaries never enter git.
- Remember `src/camera/gameCamera.ts` hides `#inspector` unless `body.boreal-debug` is toggled with backtick (`` ` ``).
- Remember `AGENTS.md`: never grow TypeScript simulation files listed in `tests/sim-home-ceiling.json`; put new simulation logic in `rust/boreal-sim`.

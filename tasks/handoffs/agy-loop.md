# agy-loop Handoff (2026-11-21 01:15 PT — Complete: Step 0 Verified, T-0299 Proposed & PR #560 Opened)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `dcd1d9d2` (`PR #559` T-0298 merged into `origin/main`, merged into `agy/loop`). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run window**: `2026-11-21T00:42-08:00` PT to `2026-11-21T01:15-08:00` PT.

## What Is Done
1. **Step 0 — Board & PR Review Inventory (Rule 15 & Rule 17, Oldest First):**
   - `git fetch origin --prune` + verified `origin/main` is `dcd1d9d2` (merged into `agy/loop`).
   - Verified all `4` open non-`agy` PRs via `gh pr view`: `#413` (`05cb5735`, `updatedAt 2026-11-14T03:58:19Z`, `1` comment, `0` reviews), `#414` (`26381111`, `updatedAt 2026-11-14T03:58:21Z`, `1` comment, `0` reviews), `#448` (`e9d8d50b`, `updatedAt 2026-11-14T03:59:39Z`, `1` comment, `0` reviews), and `#449` (`83d1b0ec`, `updatedAt 2026-11-14T04:01:58Z`, `2` comments, `0` reviews). All `4` remain unchanged; blocking verdicts retained under Rule 15's unchanged-blocked-submissions amendment.
   - Verified `tasks/events/*.json` across all branches: latest non-`agy` event remains `2026-11-18T19-08-15-grokbot-2-complete-T-0254.json`; zero new non-`agy` completed or proposed tasks waiting on review, and zero new `approve-plan` events on `agy` proposed tasks `T-0224..T-0298`.
2. **Live Headless Edge Audit & Proposal of `T-0299` (`PR #560`, branch `agy/t0299-propose` @ `c15483c7`, worktree `C:\dev\boreal-agy-t0299`):**
   - Captured live headless Microsoft Edge evidence on temporary Vite port `5266` (`0` console/page errors, browser & server cleanly stopped in `finally`): `recording.webm` (`116,365 B` VP8 WebM), `5` live PNG frames (`frame-0..4.png`), `live-capture.json`, and `2` matched natural references (`reference/ref-0..1.jpg`, `SOURCES.md`).
   - Built & ran calibrated Rule 11 verification script `refs/audit/live-universe-playas-auto-ui-audit/audit.ts` -> `numbers.json`: `calibrationValid = true` (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` on all 4 checks), `0 / 4` pass `>= 0.95`, `meanScore = 0.0000`:
     1. **`Generate universe` Big Bang skip & `Forest only (legacy)…` seed override (`frame-0`)**: 2nd `Generate universe` preserves `introComplete = true` (`clearWorldSaves(true)`), skipping `#cine` (`cineShownOnSecondGenerate = false`); `Forest only` seed `424242` is overridden on reload by stale `boreal.universe.seed.v1` (`STAGES.seed = 1587008242`); `opening.stop()` omits `sphere?.dispose()`; `menu.ts:73` typo `"Leave blank mint"`.
     2. **`Pause -> More -> Player` (`Play as`) herbivore integrity (`frame-1`)**: Embodied `Snowshoe hare` with `Autonomous: On` runs `autonomousWolfStep()` (`WOLF_AGENT`), stalking `hare:6` (`"following hare hare:6"`); wolf `Q lock` HUD & `H`/`G` howl/growl stay active for herbivores; `driveHold`/`driveCommitted` & held prey unreset on swap.
     3. **Live `Autonomous: On` wolf deadlock & conservation (`frame-2`, `recording.webm`)**: Spins `+514.5°` then deadlocks permanently (`0.0000 m` across `4/6` samples) on open-meadow stone `stones:1:-1:35` (`Δh = 0.556 m > 0.45 m` in `wolfGround`/`plan.ts:157`, deterministically reproduced in `audit.ts`), gains `+3.43` free energy (`+1.0/s`) without eating (`main.ts:691`), and never receives `scents` or `water`/`waterLevel` (`?needs=water:15` oscillates yaw).
     4. **`Data (U)` rebind hijack & `Pause -> Graphics` dual Quality / contrast (`frame-3`, `frame-4`)**: Pressing `U` in Controls `.capturing` pops `#data-panel` open (`howl` stays `H`); always-on pad `rAF`; Graphics top Quality dropdown desyncs from `renderStore` (`quality.auto = true`), clobbers `GOVERNOR.probeCap` downward, overlaps `Boreal`, and renders unreadable light-on-white `<select>` text (`< 1.3:1`).
   - Verified `npx tsx --test tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts` (`15 / 15` pass), `npx tsc --noEmit` (`0` errors), JSON UTF-8 without BOM, and zero errors on `T-0299` in `tests/tasks.test.ts`.
   - Wrote reusable skill `notes/skills/live-universe-playas-auto-ui-audit.md`, task `tasks/T-0299-live-universe-playas-auto-ui-audit.md`, propose event `tasks/events/2026-11-21T01-11-agy-propose-T-0299.json`, and handoff `tasks/handoffs/T-0299-agy.md`. Merged `agy/t0299-propose` into `agy/loop`, pushed `agy/t0299-propose`, and opened **`PR #560`**.

## Exact Next Step (Next Hourly Run)
1. Run Step 0 first: `git fetch origin --prune`, merge `origin/main` into `agy/loop`, check open PRs and `tasks/events/*.json` across all branches for any non-`agy` completed/proposed work to review (Rule 15), and check whether any `agy` task received a non-author `approve-plan` so `agy` can claim and implement it.
2. If no `agy` task is approved to claim yet, inspect the next untouched live area for **`T-0300`** (zero overlap with `T-0001..T-0299`): e.g., live **`Tab` Pad Menu / `pad3d` / `padNav`** keyboard/gamepad interaction & virtual gamepad HUD, live **`Pause -> Music`** track switching / bus mixer / ducking & `N`/`M`/`[`/`]`/`-`/`=` controls, live **`V` flora view & `O` senses halo / `I` Generation Inspector** live clicking & what-if overrides, and live **Wolf Pups + Fox Defense (`driveBridge` / `pups.ts`)** encounter!

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263..T-0299` (and merge of board-only `PR #560` into `main`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.

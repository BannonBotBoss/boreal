# Skill: `rules-gates-harnesses-diagnostics-audit`

Reusable workflow for auditing Boreal's Rule 7 board governance/ledger enforcement, Rule 11 verification & scoring gates, geographic landing/seam/capture harnesses, and interactive diagnostic review pages (`tools/*.html`, `src/core/deepTime.ts`, `tools/system-map.ts`).

## When to use
- When performing Step 8 / Rule 7 inspections of `tasks/RULES.md`, `tools/tasks.ts`, `tests/tasks.test.ts`, `tools/agent-review.mjs`, and `tools/board-github.ts`.
- When verifying that Boreal's own quality gates (`tools/anim-gate.ts`, `tools/contact-gate.ts`, `tools/wolf-view-score.ts`, `tests/huntSim.ts`), headless capture scripts (`tools/*-shot.mjs`, `tools/landing-matrix.mjs`, `tools/globe-seam-baseline.ts`, `tools/bench-lock.mjs`), and diagnostic pages (`tools/planet-layers.html`, `tools/deep-time.html`, `tools/system-map.ts`) are calibrated, cross-platform, leak-free, and physically accurate.

## Tools & files inspected
- **Board & Rule 7**: `tasks/RULES.md`, `tools/tasks.ts`, `tests/tasks.test.ts`, `tools/agent-review.mjs`, `tools/board-github.ts`.
- **Verification gates**: `tools/anim-gate.ts`, `tools/contact-gate.ts`, `tools/wolf-view-score.ts`, `tests/huntSim.ts`, `tools/hunt-sim.ts`.
- **Landing, seam & capture harnesses**: `tools/landing-matrix.mjs`, `tools/globe-seam-baseline.ts`, `tools/fall-shot.mjs`, `tools/menu-frame-capture.mjs`, `tools/cine-boot-measure.mjs`, `tools/walk-probe.mjs`, `tools/smoke-tiers.mjs`, `tools/bench-lock.mjs`.
- **Diagnostic pages & deep time**: `src/core/deepTime.ts`, `tools/deep-time.ts`, `tools/deep-time.html`, `tools/planet-layers.ts`, `tools/planet-layers.html`, `src/config/systemProperties.ts`, `tools/system-map.ts`.

## Steps
1. **Board ledger & CI audit**:
   - Run `ledger()` from `tools/tasks.ts` and cross-check every `tasks/T-*.md` YAML header (`skill:`, `credits:`) against `Task.skill` and `Task.award`.
   - Inspect `tests/tasks.test.ts` to verify whether legacy rule breaks skip new rule-break enforcement via `{ todo: ... }`.
   - Check `tools/agent-review.mjs` `AGENTS` against every active `<agent>/*` branch prefix (`cursor/`, `agy/`, `grokbot-1..3/`, `claude/`, `codex/`).
   - Check `tools/board-github.ts` for temp-directory cleanup (`rmSync`) and null-safe GitHub Project v2 field handling.
2. **Gate calibration & edge-case tests (Rule 11)**:
   - Feed degenerate/pathological inputs (`NaN` poses, `frames = 0`, frozen phase recordings, negative `extraBegins`, symmetric `-bearingDeg`) to every scoring function and confirm every gate stays bounded in `[0, 1]` and rejects known mismatches (`<= 0.25`) while passing known matches (`>= 0.95`).
   - Run `simulateHunt()` across `STYLES.skilled` vs `STYLES.naive` to confirm natural stealth advantage is preserved (not inverted).
3. **Geographic & harness portability checks**:
   - Verify every latitude/longitude in `tools/landing-matrix.mjs` against real-world Earth coastlines/topography (e.g. avoid ocean coords for `alpine` or inland mountain coords for `coast`) and run `tools/globe-seam-baseline.ts --json` to check dry-land `planetReliefM`, `localReliefM`, `movedDeg`, and `ocean edge` polarity.
   - Audit every Playwright/CDP script for OS-hardcoded browser paths, missing `try/finally` browser kills, reserved default ports (`5173–5209`), and `bench-lock.mjs` `NaN`/Chrome handling.
4. **Live Chromium capture of game & diagnostic pages**:
   - Start a temporary Vite server on an agent-owned port (e.g. `5269`, never `5173–5209`).
   - Run `npx tsx refs/audit/rules-gates-harnesses-diagnostics-audit/audit.ts http://127.0.0.1:5269` to capture `recording.webm`, `frame-0..2.png`, and `numbers.json`, then stop the temporary Vite server immediately.
   - Visually inspect every captured frame side-by-side with `reference/ref-0..2.jpg`.

## Checks that prove it worked
- `calibrationValid = true` and `5 / 5` checks `>= 0.95` in `numbers.json` after remediation.
- `npx tsc --noEmit` exits `0`.
- `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts` passes with `0` new rule breaks and `0` skipped CI integrity checks.

## Mistakes to avoid
- Do not rely on `tests/tasks.test.ts` green exit status alone while line 64 carries `{ todo: real.errors.length ? ... : false }` — always inspect `ledger().errors` directly.
- Never import `tools/wolf-lod-bench.ts` inside a CJS-resolved scratch script (it contains top-level `await`).
- Always wrap Playwright/CDP launches in `try / finally` so headless Chrome/Edge never leaks zombie processes on timeouts or exceptions, and always stop temporary Vite preview servers before finishing.
- Remember `AGENTS.md`: `src/core/deepTime.ts` is in `tests/sim-home-ceiling.json` and may only shrink; move new simulation physics into `rust/boreal-sim`.

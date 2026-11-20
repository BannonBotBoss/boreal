# Skill: `hare-runstrip-padmenu-core-terrainref-audit`

Reusable workflow for auditing Boreal's hare/wolf locomotion viewers and fore-lock diagnostics, gamepad menu layout and capture harnesses, core catalog/`STATE_FIELDS`/constants/Rust SST registries, and `tools/terrain-ref/` Python analysis pipelines.

## When to use
- When inspecting `tools/hare-sheet.ts`, `tools/run-strip.ts`, `tools/bound-score*.ts`, `tools/contact-exact.ts`, `tools/plant-path.ts`, `tools/excursion-probe.ts`, `tools/rig-trace.ts`, and `tools/bench-contacts.ts`.
- When auditing `src/ui/padMenu.ts`, `tools/menu-frame-measure.html`, `tools/padmenu.html`, `tools/glowBench.ts`, and headless browser capture scripts (`tools/*-shot.mjs`, `tools/*-record.mjs`).
- When verifying `src/core/catalog.ts`, `src/core/stateFields.ts`, `src/data/constants.json`, `rust/boreal-sim/src/constants.rs`, and `rust/boreal-sim/src/planet_fundamentals/hydrosphere/sst.rs`.
- When auditing `tools/terrain-ref/{analyse.py,beta.py,sweep.py,s2.py,s2m.py}`.

## Tools & files inspected
- **Locomotion viewers & diagnostics**: `tools/hare-sheet.ts`, `tools/run-strip.ts`, `tools/bound-plans.ts`, `tools/bound-score.ts`, `tools/bound-score-forelock.ts`, `tools/contact-exact.ts`, `tools/plant-path.ts`, `tools/excursion-probe.ts`, `tools/rig-trace.ts`, `tools/bench-contacts.ts`.
- **Pad menu, glow bench & capture scripts**: `src/ui/padMenu.ts`, `tools/menu-frame-measure.html`, `tools/padmenu.html`, `tools/glowBench.ts`, `tools/glow-bench.mjs`, `tools/{padmenu,gamepad,inpage,descent,outline,strip}-shot.mjs`, `tools/{hare-closeup,hunt}-record.mjs`, `tools/{cine-boot-arrival,needs-probe,night-run}.mjs`.
- **Core registries & Rust constants/SST**: `src/core/catalog.ts`, `src/audio/borealSound.ts`, `src/core/stateFields.ts`, `tests/stateFields.test.ts`, `src/core/sim/index.ts`, `src/data/constants.json`, `rust/boreal-sim/src/constants.rs`, `rust/boreal-sim/src/planet_fundamentals/hydrosphere/sst.rs`.
- **Terrain-ref Python pipeline**: `tools/terrain-ref/{analyse.py,beta.py,sweep.py,real.py,s2.py,s2m.py}`.

## Steps
1. **Locomotion & fore-lock diagnostics**:
   - Run `bound-score` with `foreLock: true` (matching live near-tier hares) across `[1.68, 3, 5, 8.5, 11.6] m/s` so fore-lock slip regressions are not hidden behind `foreLock: false`.
   - Run `foreContacts` (`contact-exact`) and `FORE_PLAN_DIAG` (`plant-path`) at display rate (`60 Hz`) as well as `240 Hz`.
   - Test `gaitFor('run', 3.5, WOLF_LEGS, 'gallop')` vs `gaitFor('run', 3.5, WOLF_LEGS)` to catch forced-hysteresis gait mismatches in strip/excursion tools.
2. **Live Chromium capture & UI measurement**:
   - Serve on an agent-owned port (`npx vite --host 127.0.0.1 --port 5268 --strictPort`, never `5173–5209`).
   - Run `npx tsx refs/audit/hare-runstrip-padmenu-core-terrainref-audit/audit.ts http://127.0.0.1:5268` to capture `frame-0..2.png`, VP8 `recording.webm` (via `canvas.captureStream(24)` + `MediaRecorder` with `video/webm;codecs=vp8` and `requestData()`), `menu-frame-measure.html?probe=1` metrics, and `glowBench.ts` output.
   - Visually inspect all captured frames side-by-side against `reference/ref-0..2.jpg`.
   - Close Chromium in `finally` and kill the temporary Vite server immediately after capture.
3. **Core registry, constants & Rust SST checks**:
   - Cross-check every `catalog[k].audio` against `SOUND_IDS` in `src/audio/borealSound.ts`.
   - Cross-check `STATE_FIELDS` groups against live `SimAnimal`, `Agent`, `NeedsState`, and `CloverPatch` objects.
   - Verify dry-air mole fractions (`x_N2_dry + x_O2_dry + x_Ar_dry + CO2_ppm_present * 1e-6 <= 1.0`) and `sst.rs` seawater freezing-point / finiteness guards.
4. **Terrain-ref Python edge-case checks**:
   - Test `analyse.py` boundary handling on a synthetic linear ramp (`mode='wrap'` vs `'nearest'`), exact circle lake (`D_L >= 1.0`), and low-elevation cell crop; test `beta.py` on flat and non-`30 m` power-law grids.

## Checks that prove it worked
- `calibrationValid = true` and `5 / 5` checks `>= 0.95` in `numbers.json` after fixes.
- `npx tsc --noEmit` exits `0`.
- `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts` passes with `0` new rule breaks.

## Mistakes to avoid
- Do not rely only on `tools/bound-score.ts` (`foreLock: false`); the live near-tier hare runs `foreLock: true` (`tools/bound-score-forelock.ts`).
- Use `video/webm;codecs=vp8` (not `vp9`) and call `rec.requestData()` before `rec.stop()` for reliable headless SwiftShader `MediaRecorder` WebM output.
- Always test `menu-frame-measure.html?probe=1` on `1280×720` (not only 1080p) to catch full-height modal overflow, half-sliced rows behind scroll arrows, and `upHold` non-zero residual scroll.
- Remove any temporary `node_modules` junction before committing if created in a worktree (even though `.gitignore` ignores it, keep worktrees tidy).

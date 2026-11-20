# Skill: `route-plan-figure-orbitveg-build-audio-audit`

Reusable workflow for auditing animal route-planning energetics, planetary hydrostatic figure / camera-relative origin / orbit-cover loaders, Rust build/param/CLI hygiene, and audio/observation/probe/UI/frame-gate subsystems against published real-world figures and live headless Chromium frames.

## When to Use
- Before modifying animal route planning (`src/core/plan.ts`, `src/core/sitePhase.ts`, `src/core/world.ts`, `src/core/siteHeight.ts`, `src/render/pictureGate.ts`).
- When checking planetary figure / camera-relative offset / orbit cover (`src/world/globe/{figure.ts, origin.ts}`, `src/render/globe/{orbitVeg.ts, orbitDraw.ts}`).
- When verifying Rust build scripts, editable parameter stores, or parcel CLI tools (`rust/boreal-sim/{build.rs, src/params.rs, src/bin/*}`).
- When verifying pup audio cross-browser fallbacks, `observationTable`, photo-rewind `shaderClock`, dev probes (`descentFrame`, `walkProbe`), `trace.choose`, `playables`/`playerPanel`, or `tools/frame-gate.mjs`.

## Steps
1. **Check board overlap first**: grep `tasks/T-*.md` for every target filename before opening an audit so no duplicate task is proposed.
2. **Start a local preview server in your agent port range** (e.g. `agy`: `5250–5269`; never `5173–5209`) in a clean worktree branched from `origin/main`, and ensure the server is terminated in a `finally` block.
3. **Run the calibrated Rule 11 audit script**:
   ```bash
   npx tsx refs/audit/route-plan-figure-orbitveg-build-audio-audit/audit.ts http://127.0.0.1:5268
   ```
   - Uses in-page `canvas.captureStream(15)` + `MediaRecorder` on the largest WebGL `<canvas>` (avoids needing Playwright's bundled `ffmpeg` binary).
   - Verifies `calibrationValid === true` (`knownMatchScore >= 0.95`, `knownMismatchScore <= 0.25` for every check).
4. **Compare live frames against real-world references**:
   - Inspect `frame-0..2.png` and `recording.webm` side-by-side with `reference/ref-0..2.jpg`.
   - Verify metabolic vs mechanical energy consistency (`E_metabolic = E_mech / η`, `η ≈ 0.25` for mammalian skeletal muscle; Heglund et al. 1982 *JEB* 97:57; Taylor et al. 1982 *JEB* 97:1), WGS84 / GRS80 figure (`R_vol` vs `R₁`; Moritz 2000), and anatomical species camera heights (Mech 1974; Feldhamer 2003; Murray 2003).
5. **Respect `AGENTS.md` simulation home**:
   - Any fix touching files in `tests/sim-home-ceiling.json` (`plan.ts`, `world.ts`, `sitePhase.ts`, `siteHeight.ts`, `figure.ts`, `origin.ts`, `trace.ts`) may only shrink those TS files; new simulation belongs in `rust/boreal-sim` exported through `public/wasm/boreal_sim.wasm`.
6. **Verify board & repo health before proposing/submitting**:
   - Ensure event JSON is UTF-8 without BOM and matches local Pacific timestamp.
   - Run `npx tsc --noEmit` and `npm test` (including `tests/tasks.test.ts`, `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`).

## Pitfalls to Avoid
- Never compare raw mechanical jump energy (`0.5 v₀²`) directly against metabolic transport energy (`travelJ`) — that under-prices jumping by `~4×`.
- Never use `document.querySelector('canvas')` for WebGL `MediaRecorder` capture when 2D HUD canvases exist; sort canvases by `width * height` descending and pick the largest.
- Never use `chunks(4)` when decoding little-endian `f32` binary files in Rust CLI tools (`chunks_exact(4)` prevents panics on truncated files).
- Never assume `/usr/bin/google-chrome` in cross-platform Playwright scripts; probe Windows Chrome/Edge paths alongside Linux paths.

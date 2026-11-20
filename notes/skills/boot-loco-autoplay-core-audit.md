# Skill: `boot-loco-autoplay-core-audit`

Reusable workflow for auditing Rust globe boot order & geodesic grids, locomotion planning/IK/bounding helpers, autoplay/cine/origin-bus/viewer harnesses, and core transaction/rendering/ECS invariants with calibrated Rule 11 scoring and live headless Chromium capture.

## When to Use
- Auditing `rust/boreal-sim/src/{boot_order.rs, grid.rs, sun_spectrum.rs, consts.rs, animals.rs, perception.rs, lib.rs}` against `grid_seed` parity and published geophysical equations (ISO 2533, CERES EBAF, FAO-56, IAU 2015 B3).
- Checking pure locomotion math (`touchdownPlan.ts`, `softIK.ts`, `stancePlan.ts`, `core/needs/bound.ts`, `core/gaitReadout.ts`, `core/locomotion.ts`) for sign folding, unclamped Bezier extrapolation, IEEE-754 `atan2(-0, -0)` flips, and Froude hysteresis omissions.
- Verifying `AGENTS.md` autoplay isolation (`?autoplay=0` / normal URLs vs stale `sessionStorage`), `startView` routing, `cineReady` hold monotonicity, `originBus` safety, and live WebGL viewer harnesses (`?tree=1`, `?view=farlayer`).
- Verifying core data/rendering primitives (`surfaceSampler.ts`, `coat.ts`, `drawLerp.ts`, `contactBus.ts`, `transactions.ts`, `logContact.ts`, `engineReport.ts`, `simWasm.ts`) for boundary, `NaN`, linear-light, CRLF, and retry correctness.

## Steps
1. **Start a local preview server in your own port range** (e.g. `agy`: `5250–5269`, never `5173–5209`) using `npx vite --host 127.0.0.1 --port 5269 --strictPort`.
2. **Run calibrated WASM + TS + Chromium audit** (`npx tsx refs/audit/boot-loco-autoplay-core-audit/audit.ts http://127.0.0.1:5269`):
   - Instantiate `public/wasm/boreal_sim.wasm` directly in Node to compare `grid_boot(day, hour)` vs `grid_seed(day, hour)` across all 37 `Grid` planes and compare `grid_coast_at` on a diagonal NW–SE coast (`lat + lon >= 0`) against exact spherical haversine distance to the nearest ocean cell.
   - Probe edge-case inputs on pure locomotion/core functions (backward-pointing forearms, stance `sp = -1`, unwrapped `ph > 1`, `d = 0` soft-IK, `ratio > 1`, `h < foreMin`, `Fr = 0.55` hysteresis, `NaN` alpha, empty/zero-weight meshes, sRGB midpoint linear luminance, CRLF engine reports, stale/NaN `originBus`).
   - Drive headless Chromium (`1280×720`, SwiftShader, `0` console/page errors) to capture:
     - `/?tree=1&view=lod` -> `frame-0-tree-viewer-black-spruce-lods.png` + `recording.webm` (via `canvas.captureStream(15)` + `MediaRecorder` so no external `ffmpeg` binary is needed).
     - `/?view=farlayer&alt=3000&at=72,186&noprobe=1` -> `frame-1-farlayer-and-globe-boot.png`.
     - `/?start=game&nomenu=1&noprobe=1&tier=1&at=30,0&autoplay=0` with seeded unfinished `sessionStorage['boreal.autoplay']` -> wait for `#loading` to clear, verify `window.__autoplayStarted`, press `Escape`, and capture `frame-2-locomotion-touchdown-and-play-panel.png`.
3. **Generate and compare natural/scientific reference images** (`reference/ref-0..2.jpg`) and verify every check's calibration (`knownMatchScore >= 0.95`, `knownMismatchScore <= 0.25`, `calibrationValid = true`).
4. **Stop the preview server and ensure no headless browser processes remain** before running `npx tsc --noEmit` and board/rule tests (`tests/tasks.test.ts`, `tests/gait-gate.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`).

## Pitfalls to Avoid
- Do not rely on Playwright's `recordVideo` when `ms-playwright/ffmpeg` is not installed; use in-page `canvas.captureStream` + `MediaRecorder` (`video/webm;codecs=vp8`).
- Always wait for `#loading` to vanish before screenshotting ground/pause UI so the loading card does not obscure the live frame.
- Remember Rule 19 (`gait`/`locomotion` tags): implementing fixes requires real animal footage URLs, a committed side-by-side clip, and sourced numbers in the `complete` event.
- Remember `AGENTS.md`: allowlisted simulation files in `tests/sim-home-ceiling.json` may only shrink; place new or repaired simulation logic in `rust/boreal-sim`.

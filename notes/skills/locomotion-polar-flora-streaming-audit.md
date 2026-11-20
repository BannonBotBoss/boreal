# Skill: `locomotion-polar-flora-streaming-audit`

Reusable workflow for auditing Boreal's locomotion CPG/IK/swing/rig layer, Rust polar climate seed & surface albedo/bucket physics, forest micro-relief/flora/material/social ecology, and worker/streaming/moult contracts against published real-world sources and live WebGL frames.

## When to use
- Auditing or repairing `src/animals/locomotion/{cpg.ts, ik.ts, footSwing.ts, fork/playerRig.ts}`
- Auditing or repairing `rust/boreal-sim/src/planet_fundamentals/{climate_seed.rs, energy/albedo.rs, hydrosphere/soil_moisture.rs, hydrosphere/humidity_column.rs, planet_initialization.rs}`
- Auditing or repairing `src/core/{surface.ts, flora/plants.ts, materials.ts, needs/social.ts, rigBody.ts}`, `src/render/{mass.ts, terrainWorker.ts, groundHold.ts}`, or `src/world/globe/landingStream.ts`

## Steps
1. **Run the calibrated Rule 11 audit script** against a local Vite preview server on an agent-owned port (e.g. `5266`, never `5173`):
   - `npx vite --host 127.0.0.1 --port 5266 --strictPort`
   - `npx tsx refs/audit/locomotion-polar-flora-streaming-audit/audit.ts http://127.0.0.1:5266`
2. **Verify all 5 checks and calibration**:
   - Confirm `calibrationValid === true` (known matches `>= 0.95`, known mismatches `<= 0.25`).
   - Check `numbers.json`, `recording.webm`, `frame-0-loco-lab-real-gallop-tail.png`, `frame-1-antarctica-jan15-globe.png`, and `frame-2-boreal-forest-floor-june.png` side-by-side against `reference/ref-0..2.jpg`.
3. **Apply fixes under `AGENTS.md` simulation-in-Rust rules**:
   - Keep `tests/sim-home-ceiling.json` files shrinking; move new/repaired simulation math into `rust/boreal-sim` and rebuild `public/wasm/boreal_sim.wasm` (`npm run build:wasm`).
   - For gait/locomotion tasks (Rule 19), include real animal footage URLs, a committed side-by-side clip, and sourced numbers in the `complete` event.
4. **Re-verify**:
   - Re-run `audit.ts` until `5 / 5` checks pass `>= 0.95` with `0` console/page errors.
   - Run `cargo test --manifest-path rust/boreal-sim/Cargo.toml`, `npx tsc --noEmit`, and `npm test`.
   - Stop the preview server and kill any headless browser processes before committing.

## Mistakes to avoid
- **Canvas selection in `locomotion-lab.html`**: `document.querySelector('canvas')` may match `<canvas id="strip">` (the 2D footfall strip) instead of the 3D WebGL canvas; always select `Array.from(document.querySelectorAll('canvas')).find(c => c.id !== 'strip')` and use in-browser `MediaRecorder` (`vp8`/`vp9` + `requestData()` on stop) rather than Playwright's `recordVideo` when Playwright's bundled `ffmpeg` is absent.
- **Unsettled ground screenshots on SwiftShader**: Always pass `&noprobe=1&tier=0` and wait for `!document.getElementById('loading')` before screenshotting `?view=ground`, otherwise SwiftShader captures the birch/beaver loading overlay.
- **Polar-day Budyko albedo feedback**: Never trigger sea-level ice-free albedo (`t_c >= -10°C`) from instantaneous polar-day summer solstice insolation on continental ice sheets; evaluate persistent ice sheets on annual-mean climate and mask boreal conifer snow albedo (`0.11–0.21`) separately from open snow (`0.80`).

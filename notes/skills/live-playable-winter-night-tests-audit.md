# Skill: Live Playable Species, Seasonal/Midnight Ground & Windows Test Suite Audit (`live-playable-winter-night-tests-audit`)

Reusable procedure for auditing Boreal's live interactive playable species (`?play=deer`, `?play=hare`, `?play=wolf`), seasonal/diurnal ground rendering (`?day=15&hour=12` midwinter snow, `?day=227&hour=0` midnight sky), narrow/mobile HUD CSS (`src/ui/senses.css` `@media(max-width:700px)`), interactive button round-trips (`#autonomous`, `#home`, `#pause`), and cross-platform Windows `npm test` suite health.

## Steps
1. **Capture live multi-mode headless browser telemetry & media (agent port range `5250–5269`, plain `.mjs` script)**:
   - Write the capture runner as plain ESM `.mjs` (avoid `tsx` `keepNames` `__name` injection inside `page.evaluate()`).
   - Start Vite on a dedicated port in `5250–5269` (`--host 127.0.0.1 --port <P> --strictPort`) and always kill the Vite child process and `browser.close()` inside `finally`.
   - Capture at least:
     - `?nomenu=1&seed=1400&noprobe=1&stages=1&trees=v2&rec=1&play=deer` (`1280×720`) + VP8 WebM `canvas.captureStream` recording walking (`W`) and turning (`D`).
     - `?nomenu=1&seed=1400&noprobe=1&stages=1&trees=v2&rec=1&play=hare` (`1280×720`).
     - `?nomenu=1&seed=1400&noprobe=1&stages=1&trees=v2&rec=1&day=15&hour=12` (`1280×720`, midwinter snowpack).
     - `?nomenu=1&seed=1400&noprobe=1&stages=1&trees=v2&rec=1&day=227&hour=0` (`1280×720`, midnight sky & `body.night`).
     - Narrow/mobile `640×720` viewport with interactive clicks on `#autonomous`, `#home`, `#pause`, and `Escape`, logging `window.__boreal.player()` before/after and all HUD `getBoundingClientRect()` boxes + pairwise overlap areas.
2. **Measure rendered PNG pixels deterministically (Rule 11, not eyeballed)**:
   - Use `pngjs` inside `audit.ts` to measure midwinter ground luminance, neutral snow-white pixel fraction (`lum >= 0.65`, chroma `< 35`), and olive/green-dominant pixel fraction against the HUD-reported `Snow X.X cm`.
   - Measure midnight sky upper-band bright star pixel count (`lum > 180`) and horizontal pixel-to-pixel luminance MAD to detect static-noise bands.
   - Verify live code paths match unit-tested code paths (e.g., streamed `buildLeaf` vs unit-tested `buildContinuousMesh` in `src/render/continuousTerrain.ts`).
3. **Audit playable species parity & responsive HUD CSS**:
   - Check camera framing geometry (`positionCamera` in `src/render/math.ts` + `PLAYABLES.cameraHeight` in `src/render/playables.ts`) against each species' standing height.
   - Verify species-specific physics/senses wiring (`footing()` body plan in `src/main.ts`, `deltaSources()` scent range in `src/ui/senses.ts`, herbivore vs predator HUD hints).
   - Inspect `@media(max-width:700px)` flex-column containers for `flex: 1` (`flex-basis: 0%`) height collapse on `.sense-stream` and check pseudo-element centering (`::before` `left` vs container width/2).
4. **Profile full `npm test` on Windows**:
   - Run `npm test`, capture full log, and tabulate pass/fail/skip/todo counts, wall time, CPU sum, and tests `> 5 s`.
   - Audit every Windows path/EOL failure (`new URL(...).pathname` vs `fileURLToPath`, backslash vs `/`, CRLF vs LF) and verify whether `TODO`-muted tests (e.g., `tests/gait-data.test.ts` `LIVE` rows) actually pass today and should be unmuted.
5. **Run calibrated Rule 11 script & compare against natural documentary references**:
   - Execute `npx tsx refs/audit/live-playable-winter-night-tests-audit/audit.ts` and confirm `calibrationValid = true` (`knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`).
   - Compare captured live frames side-by-side against matched natural references (`ref-0..2.jpg`, study-only under `refs/audit/`).

## Common Mistakes to Avoid
- Never run Playwright `page.evaluate()` helpers through `tsx` if inner function declarations exist: `tsx`'s `keepNames` emits `__name(...)` which throws `ReferenceError: __name is not defined` inside the browser context. Use plain Node `.mjs` for capture scripts.
- Never trust unit tests on `buildContinuousMesh` alone to prove live terrain snow: live streaming uses `buildLeaf`, which can drift silently if not tested directly.
- Never leave temporary Vite servers or headless Edge instances running after capture; verify zero open sockets on your port range before finishing.
- Write all board event JSON files as UTF-8 without a BOM and verify with `tests/tasks.test.ts` and `tests/gait-gate.test.ts`.

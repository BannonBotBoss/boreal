# Skill: `sun-badges-perception-gamepad-audit`

Reusable workflow for auditing Boreal's solar viewer & spectral/sunspot physics, core badges/events/living-pack persistence, embodied perception/LOD renderers, and gamepad/pad-router/layout stack under Rules 6, 11, 12, and `AGENTS.md`.

## Steps
1. **Solar viewer live capture & physics check (`tools/sun.html`, `src/world/sun/{sunView,bands,spectrum,sunspots}.ts`):**
   - Start a temporary Vite preview server on an agent-range port (`agy`: `5250–5269`, never `5173–5209`) and open `tools/sun.html` in headless Chromium (SwiftShader, `1280×720`).
   - Verify default load without `?date=` against the latest date in `public/data/silso/SN_d_tot_V2.0.csv` (`window.__sun.R` and `groups`).
   - Load an active solar-maximum date (`?date=2024-05-10&band=visible&elev=space&settled=1&focal=1400`), record a continuous VP8 WebM sweep via `canvas.captureStream(20)` + `MediaRecorder` while switching `#camera-panel select` across `visible -> halpha -> euv304 -> euv171 -> euv193 -> xray`, and capture PNG frames for `visible`, `euv171`, and `halpha`.
   - Compare captured frames side-by-side against matched NASA SDO/HMI, SDO/AIA 171 Å, and H-alpha scientific references; verify `EffectComposer` actually attaches `UnrealBloomPass` and `OutputPass`, test viewport resize (`setViewportSize`), test invalid query resilience (`?date=not-a-date`), and probe `quietBrightness`, `scaleHeight`, `cycleAt(1980)`, `planck(T < 0)`, `chromaticity(discXYZ(-0.1))`, shared `proc/rng`, and 32-bit safe integer seed hashing.
2. **Core badges, events & living pack (`src/core/{badges,events,enterLiving,storedAnimal}.ts`, `src/data/controls.json`):**
   - Count live quiz pools vs gated controls in `controls.json`.
   - Probe `badges.ts` with corrupted `"null"` storage, `earn('look', NaN)` cap bypass, negative `less`, `submitTest` with `hints: []` and `qs.length < pool.perAttempt`, and CSP-unsafe `new Function(...)`.
   - Probe `events.ts` with `parseContext('null')`, `consumeForage()` `why`-chain retention on player-remembered animals, and `rockDiameter === 0` guard.
   - Probe `enterLiving()` species check when `handle` is passed, `livingRoster()` immutability, and `readStoredPack()` rejection of `NaN` fields and trailing bytes.
3. **Embodied perception, halo, thought bubbles & animal picture LOD (`src/render/{animalPicture,animalLadder,sensesHalo,thoughtBubbles}.ts`, `src/core/{sensePictures,perceptionBuffer}.ts`):**
   - Verify `setOpacity` sets `material.transparent`, impostors are alpha-silhouetted with per-instance fade, speck vertex shader `main()` uses `uH`, `arrestGlide` preserves bounded velocity, `sensesHalo` does not spike speed on frame-1 spawn near origin, `thoughtBubbles` uses camera-up and expires/caps sprites, `sensePictures` filters `salience <= 0` and evicts weakest at cap, `readPerception` rejects `NaN`/`Infinity`, and all render helpers provide `dispose()`.
4. **Gamepad, pad router & pad menu layout (`src/input/{gamepad,padRouter,padTargets}.ts`, `src/ui/padMenuLayout.ts`):**
   - Probe `standardPad()` with non-standard HID fallback, `createPadReader()` with `now = NaN`, `padRouter` clock consistency (`yDownAt` vs `frame(pad, now)`), radial `n = 0` + HTML escaping + `axis`/`globe` ownership return + `dispose()`/`stop()`, and `padMenuLayout` (`holdStepCount(rate=0)`, `menuFrame` with `NaN`, `focusAfterScroll` with no selectable rows, and `createHoldRepeat.stop(src)` default `now`).
5. **Calibrated Rule 11 gate & teardown:**
   - Score every check with `knownMatchScore === 1.0` and `knownMismatchScore === 0.0` (`calibrationValid = true`), kill Vite (`taskkill /PID <pid> /T /F`) and browser in `finally`, and confirm `0` `LISTENING` sockets remain on the preview port.

## Verification commands
```powershell
npx tsx refs/audit/sun-badges-perception-gamepad-audit/audit.ts http://127.0.0.1:5268
npx tsc --noEmit
npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts
```

## Mistakes to avoid
- Do not rely on Playwright's `recordVideo` (requires external `ffmpeg-1013` binary); use in-page `canvas.captureStream(20)` + `MediaRecorder('video/webm;codecs=vp8')`.
- Do not eyeball frames without checking shader/composer wiring: a single `//` comment on `sunView.ts:62` silently dropped both `UnrealBloomPass` and `OutputPass`.
- Never test `uH` usage against the whole shader string (`uniform float uH;` matches even when unused in `main()`); inspect the `void main()` body specifically.
- Remember `AGENTS.md`: when implementing fixes, never increase line counts of TypeScript simulation files in `tests/sim-home-ceiling.json`; move new simulation logic to `rust/boreal-sim`.

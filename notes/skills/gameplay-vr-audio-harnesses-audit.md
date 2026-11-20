# Skill: `gameplay-vr-audio-harnesses-audit`

Reusable workflow for auditing Boreal's live end-to-end 720p gameplay HUD layout & `autoplay` harness, WebXR hands-only VR modules, Web Audio / Gamepad haptics / unaudited UI controls, and standalone `.mjs` verification & WASM build scripts.

## When to use
- When inspecting live ground/globe HUD layout on `1280×720` (`src/style.css`, `index.html`, `src/ui/cameraPanel.ts`, `src/ui/dataPanel.ts`, `src/input/autoplay.ts`, `tests/slow/autoplay.test.ts`).
- When auditing WebXR / VR hands-only sessions (`src/vr/session.ts`, `src/vr/forestSession.ts`, `src/vr/forestHands.ts`, `src/vr/journey.ts`).
- When inspecting Web Audio mixing, music crossfades, Big Bang audio, Gamepad haptics, Senses HUD, and editor/menu UI panels (`src/audio/*.ts`, `src/ui/{haptics,senses,chronometer,appearancePanel,cameraPanel,padNav,pad3d,badgePanel,loading}.ts`).
- When auditing cross-platform portability and teardown of standalone `tools/*.mjs` capture scripts and `tools/build-wasm.mjs`.

## Tools & files inspected
- **Live gameplay HUD & autoplay**: `src/style.css`, `index.html`, `src/input/autoplay.ts`, `tests/slow/autoplay.test.ts`, `src/world/globe/globeView.ts`.
- **WebXR / VR**: `src/vr/session.ts`, `src/vr/forestSession.ts`, `src/vr/forestHands.ts`, `src/vr/journey.ts`.
- **Audio, haptics & UI**: `src/audio/borealSound.ts`, `src/audio/mixer.ts`, `src/audio/music.ts`, `src/audio/bigBang.ts`, `src/ui/haptics.ts`, `src/ui/senses.ts`, `src/ui/chronometer.ts`, `src/ui/appearancePanel.ts`, `src/ui/cameraPanel.ts`, `src/ui/padNav.ts`, `src/ui/pad3d.ts`, `src/ui/badgePanel.ts`, `src/ui/loading.ts`.
- **Harnesses & build tooling**: `tools/{cine-arrival-trace,data-panel-shot,descent-frame-shot,flydown-shot,hare-rig-record,music-shot,needs-record,reheat-shot,t0073-shot,t0135-shot,t0136-shot,t0137-shot,t0169-shot,wolf-lod-record,build-wasm}.mjs`.

## Steps
1. **Live Chromium gameplay & DOM overlap capture**:
   - Serve on an agent-owned port (`npx vite --host 127.0.0.1 --port 5269 --strictPort`, never `5173–5209`).
   - Run `npx tsx refs/audit/gameplay-vr-audio-harnesses-audit/audit.ts http://127.0.0.1:5269` to capture `frame-0-live-globe-view.png`, `frame-1-live-forest-wolf-ground.png`, `frame-2-live-hud-chronometer-senses.png`, VP8 `recording.webm` (via `canvas.captureStream(20)` + `MediaRecorder`), and exact DOM overlap rectangles (`px²`) + `#device` vertical overflow (`scrollHeight - clientHeight`).
   - Visually compare `frame-0..2.png` against `reference/ref-0..2.jpg`.
   - Close Chromium in `finally` and stop the temporary Vite server immediately after capture.
2. **WebXR / VR orientation & lifecycle probes**:
   - Verify `headingToward` and `snapYaw` against Three.js `-Z` forward `(-sin yaw, -cos yaw)`: turning right (`+1`) must produce `fx > 0`.
   - Verify `journey.ts` glide heading uses `atan2(-dx, -dz)`, `'dark'` phase is reachable, `sphere <-> globe` is reversible, `session.ts` removes `#iwsdk-root` on catch, and `forestSession.ts` cleans up `sessionend`, guards rAF patching, and raycasts against `heightAt`.
3. **Audio, haptics & UI boundary checks**:
   - Feed `NaN` to `VOLUME_SETTINGS` `apply()` and confirm `BUS_LEVEL` remains finite.
   - Feed `land` (`scale = 1.6`, `FEEL.intensity = 1.5`) through `createHaptics` and verify `[0, 1]` W3C rumble clamping plus `pulse()` routing to injected `HapticTargets`.
   - Verify `createNumberEntry().input('menuAlt')` toggles sign, `stateFromSearch('?N=abc&t=0&iso=-100')` stays finite/positive, `appearancePanel` matches capture `true` on `removeEventListener`, and `senses.ts` uses active species scent range.
4. **Harness portability scan**:
   - Check every `tools/*.mjs` script for hardcoded browser paths, `new URL(...).pathname` (must use `fileURLToPath`), forbidden ports (`5173–5209`), Linux `/tmp` or `/agent` paths, external live URLs, TDZ listener ordering, missing `try/finally`, and bare `.kill()` without Windows tree-kill.

## Checks that prove it worked
- `calibrationValid = true` and `5 / 5` checks `>= 0.95` in `numbers.json` after fixes.
- `npx tsc --noEmit` exits `0`.
- `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts` passes with `0` new rule breaks.

## Mistakes to avoid
- Under `tsx` / `esbuild`, do NOT declare inner named helper functions (`const rect = () => ...`) inside a function callback passed to Playwright `page.evaluate(() => ...)`; `esbuild` injects `__name(...)` which throws `ReferenceError` in the browser. Pass a JS expression string to `page.evaluate('...')` instead.
- Do not rely on Playwright's `recordVideo` option on Windows machines without `ms-playwright/ffmpeg`; record WebM directly from `canvas.captureStream()` with `MediaRecorder` (`video/webm;codecs=vp8`) and call `rec.requestData()` before `rec.stop()`.
- Always verify live `1280×720` DOM bounding-box overlaps (`px²`) rather than assuming CSS overlays are clear from reading one stylesheet alone (`#camera-panel` is styled inline in JS, hiding its collision with `src/style.css`'s `footer`).

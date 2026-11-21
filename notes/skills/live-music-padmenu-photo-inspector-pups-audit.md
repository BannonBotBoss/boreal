# Skill: Live Music/Audio Sync, Pad Menu & Photo Mode UX, Inspector Picking/Senses & Pup/Drive Telemetry Audit

Use this skill when auditing or fixing Boreal's live audio-panel/hotkey synchronization (`Pause -> Music`, `#sound`, `borealSound.ts`), `Tab` Pad Menu & Photo Mode overlay interactions (`padMenu.ts`, `photoMode.ts`, `gallery.ts`, `gameCamera.ts`), Generation Inspector picking/live-refresh & Senses HUD entity coverage (`buildScene.ts`, `inspector.ts`, `senses.ts`), and Rust-WASM `driveBridge.ts` telemetry + wolf-pup animation/scale fidelity (`pups.ts`, `main.ts`).

## Steps
1. **Start an isolated Vite dev server on an agent-range port** (`agy`: `5250–5269`, never `5173–5209`) and launch headless Edge/Chromium (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) at `1280×720` on `?nomenu=1&noprobe=1&rec=1&seed=1400&stages=1`. Always stop the browser and tree-kill Vite in `finally`.
2. **Audit `Pause -> Music` & audio hotkey/HUD sync**:
   - Press `M` in live play and compare `localStorage['boreal.volume.v1']['volume.muted']` against `#sound.textContent` (`main.ts:392–397` must subscribe `soundLabel` to `onBusChange`).
   - Open `Pause -> Music`, select `Off` in Track `<select>`, then click `Reset to defaults`: verify all `6` bus sliders, `Mute everything (M)`, and `Music on (N)` survive reset (prevent `settingsPanel.ts:27` `form.replaceWith(...)` from wiping composed child sub-forms and re-inserting the bogus `"* applies when you resume (the world regenerates)."` legend), and verify `volume.musicOn` resets to `true` alongside `MUSIC.source = 'Fingerpicked'`.
   - Verify `controls.ts:58` fixed-key copy matches `src/core/bindings.ts` (remove stale `"V flora view"`).
3. **Audit `Tab` Pad Menu & Photo Mode UX**:
   - Open `Tab` Pad Menu (`.padm`): verify clicking `.padm-body .it` rows with a mouse triggers selection/activation and `Settings -> Debug HUD` calls `host.close()` before opening Inspector.
   - Enter Photo Mode via `#photo-btn`: select `B&W` and confirm `Preset` `<select>` retains `"B&W"` instead of snapping back to `"None"` (`photoMode.ts:62`); take a shot, press `G`, and confirm `#photo-gallery` does not stack over active `#photo` (`gameCamera.ts:87`); enter Gallery -> `Edit` and confirm `Escape` cleanly cancels Edit (`endEdit(false)`); verify `gallery.ts:113–115` revokes Preview `URL.createObjectURL(...)` blobs on close/re-preview.
4. **Audit Generation Inspector picking, 6 Hz refresh & Senses HUD coverage**:
   - With `body.boreal-debug` + `I` open, click directly on the visible mother wolf, deer, hare, pups, and Red Fox: ensure `buildScene.ts:667–676` (`pick()`) raycasts `AnimalPicture` Meshy GLB roots (which hide procedural `wolf.root`/`rig.root` via `setBodyShare(..., 0)` in `animalDensity.ts:242`) plus `litter` pups and `landing` cast meshes.
   - Ensure `inspector.ts` live animal refresh patches values in place (or skips `root.replaceChildren()` while focus is inside `#inspector`), removes the redundant line-63 `chunkSeed` call, and adds `drivePose()` (Red Fox) and `pupCloud()` (5 wolf pups) to `senses.ts:104–126` (`sources` & `visualBodies`).
5. **Audit `driveBridge.ts` Rust-WASM telemetry, `CHARGE_M` gait & pup animation/scale**:
   - Record a VP8 WebM (`canvas.captureStream(15)` + `MediaRecorder`) while sampling `window.__borealDrive`, `window.borealLanding()`, and `window.__borealPups`.
   - Ensure `driveBridge.ts:62–68` publishes live Rust `wasm.drives_tick()` output to `globalThis.__borealDrive` (and keeps `driveSnapshot()`/`driveParams()` fresh) so telemetry never drifts `21+ m` behind the rendered Red Fox.
   - In `main.ts:706–710`, derive `brain.motion`/`brain.speed`/`brain.gaitSpeed` during `now.hold` from actual step displacement (`hypot(now.mamaX - prevX, now.mamaZ - prevZ) / dt`) so mama wolf stands alert (`'idle'`) once `CHARGE_M = 4.5 m` is reached instead of running in place at `3.2 m/s`.
   - In `pups.ts:82, 90–95, 115, 118`, preserve non-uniform pup proportions in `place()`, pass `moving = motion !== 'idle'` so `'jump'` pounces don't add idle torso breathing bob, and pose distinct `'sit'` / `'sniff'` / `'pounce'` / `'tumble'` postures.
6. **Verify gates**:
   - Run `npx tsx refs/audit/live-music-padmenu-photo-inspector-pups-audit/audit.ts` -> `calibrationValid = true`, `4 / 4` pass `>= 0.95`.
   - Run `npx tsc --noEmit` and `npm test` (`tests/sim-home.test.ts`, `tests/rules.test.ts`, `tests/gait-gate.test.ts`, `tests/tasks.test.ts`).

## Pitfalls to Avoid
- Never wrap `settingsPanel()` by mutating its returned DOM element when `Reset to defaults` replaces `form` via `form.replaceWith(settingsPanel(...))` — pass a custom `onReset` hook or compose both schemas into one unified builder so child sections aren't wiped on reset.
- Remember `AGENTS.md`: simulation files in `tests/sim-home-ceiling.json` may only shrink; any new/expanded simulation logic belongs in `rust/boreal-sim` compiled to `public/wasm/boreal_sim.wasm`.
- Never use Playwright's `recordVideo` without verifying the bundled ffmpeg binary exists; use in-browser `canvas.captureStream(15)` + `MediaRecorder` for zero-install portable VP8 WebM recordings.

# Skill: Live Data (U) Panel / CosmosSphere, Viewfinder Camera & Gallery Export, Corrupt `localStorage` Recovery, and Standalone Interactive Tools Audit

Use this skill when auditing or fixing Boreal's live `Data (U)` panel & early-universe `CosmosSphere` (`src/ui/dataPanel.ts`, `src/world/cosmos/sphere.ts`), viewfinder `#camera-panel` badge gating & Photo Gallery export pipeline (`src/camera/gameCamera.ts`, `src/ui/cameraPanel.ts`, `src/photo/gallery.ts`, `src/ui/badgePanel.ts`), corrupted `localStorage` boot resilience & `Pause -> Save` honesty (`src/core/badges.ts`, `src/main.ts`, `src/ui/menu.ts`), and standalone interactive dev/science viewers (`tools/gamepad.html`, `tools/locomotion-lab.html`, `tools/planet-layers.html`, `tools/deep-time.html`, `tools/tree-viewer.html`, `tools/padmenu.html`).

## Steps
1. **Start an isolated Vite dev server on an agent-range port** (`agy`: `5250–5269`, never `5173–5209`) and launch headless Edge/Chromium (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Record a real VP8 WebM screencast via CDP `Page.startScreencast` + `ffmpeg` (if Playwright's bundled ffmpeg is absent) and always close the browser & kill Vite in `finally`.
2. **Audit Live `Data (U)` Panel & `CosmosSphere` (`/?nomenu=1&noprobe=1`)**:
   - Press `u`, wait for `section[data-engine]` cards, and verify each parameter key appears only once on its owning engine card (fix `dataPanel.ts:494` which injects all `8` `planet` params onto `11` unrelated cards -> `88` duplicate inputs).
   - Compare `paintDrives()` values against the Rust `prey`/`hunger`/`senses`/`danger`/`protect` engine cards (fix the `1.45e6×` `Mother effort` mismatch: `1.45e+12` vs `1.000e+6`).
   - Verify `Escape` closes `#data-panel` instead of opening Pause Menu (`z-index: 40`) behind `#data-panel` (`z-index: 70`).
   - Set `#tier-lock` and `#tier-target` *before* clicking `#view-early`, verify `CosmosSphere` honors them on mount, verify `#follow-clock` clears stale `#cosmos-fps` / `#cosmos-tier`, and draw numeric axis ticks/bounds on `Expansion` and `Reheating` plots.
3. **Audit Live Viewfinder `#camera-panel` & Photo Gallery Export**:
   - Instrument `URL.createObjectURL`, `URL.revokeObjectURL`, and `HTMLAnchorElement.prototype.click` via `page.addInitScript`.
   - Check how many `#camera-panel` controls are locked `🔒` on fresh boot (`7 / 9`) and verify gameplay calls `earn()` and mounts an accessible Badges UI so players are not permanently stuck at `0` credits.
   - Verify `Shift+P` in live gameplay actually triggers `vf.shoot(true)` and stores an EXR blob in IndexedDB (`boreal.photos`).
   - Verify newly captured viewfinder shots default to `selected: true` (or `Export` warns instead of `"Exported 0 file(s)."`), `Resolution`/`Aspect`/`Format` options are either applied to viewfinder shots or disabled with clear messaging, `#photo-gallery select` meets WCAG 2.1 AA `>= 4.5:1` contrast, and `Preview` revokes prior ObjectURLs.
4. **Audit Corrupted `localStorage` Resilience**:
   - Boot a fresh browser context with `localStorage.setItem('boreal.badges', 'null')` + malformed weather/deltas/ground/needs/clock JSON and verify boot succeeds cleanly without throwing in `hasBadge()` or misreporting `"3D unavailable... WebGL2"`.
   - Boot with `localStorage.setItem('boreal.events.v1', '{not-valid-json')`, wait past `#loading`, verify the corrupt-save warning remains visible, verify Pause Menu provides an explicit backup + reset recovery button, and verify `Pause -> Save` never displays `"Saved <time>"` when `saveBlocked === true`.
5. **Audit Standalone Interactive Tools (`tools/*.html`)**:
   - Load `tools/gamepad.html`, `tools/planet-layers.html`, `tools/deep-time.html`, `tools/locomotion-lab.html`, `tools/tree-viewer.html`, and `tools/padmenu.html` with `0` console/page errors.
   - Verify `tools/gamepad.html` responds to mouse clicks on `.tab` and `.row`; `tools/locomotion-lab.html` `<select>`/`<button>` controls meet WCAG 2.1 AA `>= 4.5:1` contrast; `tools/planet-layers.html` draws a numeric colorbar legend and lat/lon graticule/coastlines; and `tools/deep-time.html` lands `Earth forms (-4.54 Gyr)` in `Hadean` without mislabeling `-538.8 Ma` Cambrian as having terrestrial forests (Middle Devonian `~385 Ma`, Stein et al. 2007/2012).
6. **Verify gates**:
   - Run `npx tsx refs/audit/live-datapanel-viewfinder-save-tools-audit/audit.ts` -> `calibrationValid = true`, `4 / 4` pass `>= 0.95`.
   - Run `npx tsc --noEmit` and `npm test` (`tests/sim-home.test.ts`, `tests/rules.test.ts`, `tests/gait-gate.test.ts`, `tests/tasks.test.ts`).

## Pitfalls to Avoid
- Never touch files in `tests/sim-home-ceiling.json` (`src/core/badges.ts`, `src/core/deepTime.ts`) in a way that increases their line count — keep fixes strictly `<=` ceiling or move new simulation logic into `rust/boreal-sim` (`AGENTS.md`).
- Never leave `URL.createObjectURL` blobs unrevoked in gallery preview/export paths, and never display `"Saved <time>"` when `saveBlocked` prevented persistence.

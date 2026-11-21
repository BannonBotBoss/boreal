# Skill: Live Globe Layer Panel / Hadean Clouds, Axis Cutaway & SPH Parcels, In-Page Globe Menu / `C` Stealth-Camera Collision, and Mobile `390×844` Responsive Audit

Use this skill when auditing or fixing Boreal's standalone & in-page globe layer toggles (`layerPanel.ts`, `globeView.ts`, `orbitAlbedo.ts`), through-planet PREM axis cutaway & SPH parcel visualization (`axisView.ts`, `parcels.ts`), in-page globe `Shift+G` menu/prompt/WASD handling & `C` stealth-vs-camera hotkey collision (`inpage.ts`, `cameraPanel.ts`, `menu.ts`, `main.ts`), and narrow/mobile portrait (`390×844`) responsive HUD, Photo Mode, Controls, and touch-input layouts (`style.css`).

## Steps
1. **Start an isolated Vite dev server on an agent-range port** (`agy`: `5250–5269`, never `5173–5209`) and launch headless Edge/Chromium (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`). Always stop the browser and tree-kill Vite in `finally`.
2. **Measure compositor pixel diffs via Playwright PNG screenshots** (never `ctx.drawImage()` on a non-`preserveDrawingBuffer` WebGL canvas, which reads transparent black outside `rAF`):
   - Load `/?view=globe&shot=1&panel=1&seed=1400&stages=1`, wait for `window.__globe?.bootSettled && window.__orbitCover` plus steady frames, capture baseline PNG, then toggle `clouds`, `vegetation`, `ocean`, `venus`, and positive control `sunlight` one by one and compare the central planet disc region.
   - Verify `isOn('clouds')` gates `ORBIT_DRAW.uOrbitDeck.value` (`orbitAlbedo.ts:164–167` / `globeView.ts:681`) so unchecking `Clouds` or visiting Hadean `?deep=-4.45e9` removes modern white Blue Marble cyclone clouds (`whiteCloudFrac < 0.05` vs broken `38.88%`).
   - Verify `isOn('vegetation')`, `isOn('ocean')`, and `isOn('venus')` are wired (or remove dead checkboxes), `layerPanel.ts` updates checkbox states in place without `box.replaceChildren()` wiping keyboard focus, `startGlobe` (`globeView.ts:101`) honors `readUniverseSeed()` (`boreal.universe.seed.v1`), and `globeView.ts:194` mounts `#globe-layers` for in-page `Shift+G` globe mode (`layerPanelShown`).
3. **Audit Through-Planet Axis Cutaway & SPH Parcels (`/?view=globe&r=0&seed=1400&stages=1`)**:
   - Move `lineMat.onBeforeCompile = withLogDepth;` out of the end-of-line `//` comment on `axisView.ts:24`.
   - Fix `globeView.ts:320` (`dblclick` in axis mode) to pass `pickSurface(e)` instead of camera nadir `[dir.x, dir.y, dir.z]`.
   - Style `axisView.ts:55` buttons with high-contrast dark surfaces (`>= 4.5:1` WCAG AA) so they are not white-on-white; add `axis.dispose()` and call it in `globeView.ts:523–530` so DOM & GPU buffers never leak; and bound/clip `parcels.ts:35` `gl_PointSize` cleanly so the molten iron core is not occluded by giant `48 px` outer discs protruding past the limb.
4. **Audit In-Page Globe Menu / Prompt / WASD Orbit & `C` Stealth-Camera Collision**:
   - Decouple `#camera-panel`'s `'c'` toggle (`cameraPanel.ts:25`) from the default wolf Stealth hold key (`bindings.ts:39`, `C stealth`) — route camera panel toggle through a non-conflicting rebindable action or `Shift+Alt+C` / `V` (`cameraMode`), and ensure case-insensitivity and overlay/capture guards.
   - When `Escape` opens the menu on in-page globe (`main.ts:451`), use `togglePause()` (or allow `Escape` in `menu.ts:117` to close `start` mode when a live world is active), hide `#flight-prompt` while `overlayOpen()` is true (`inpage.ts:381`), preserve ascent coordinates rather than resetting to `forestLanding()` (`inpage.ts:217–222`), and wire `W/A/S/D` orbit keys declared in `bindings.ts:71–74`.
5. **Audit Live Mobile Portrait (`390×844`, `hasTouch: true, isMobile: true`)**:
   - Prevent `#interaction` and `#camera-panel` from overflowing `390 px` width and forcing layout viewport zoom-out (`548×1186`) or pushing `#camera-panel` `301 px` off-screen; eliminate `12,194 px²` `header` vs `#status` overlap and `Data (U)` collision.
   - Add `@media (max-width: 700px)` rules in `src/style.css` for `#photo-bar` (full width, wrapping/scrollable without `76 px` crush / `459 px` overflow), `#photo-panel` (collapsible drawer), `#photo-hints` (wrapped within `100vw`, clearing `Data (U)`), and `.ctl-screen` (single-column stack eliminating `324 px` horizontal overflow).
   - Provide touch movement/interact affordances (or virtual touch stick / tap-to-move) on touch devices (`hasTouch: true`) so mobile players can move the animal without a physical keyboard.
6. **Verify gates**:
   - Run `npx tsx refs/audit/live-globe-layers-axis-inpage-mobile-audit/audit.ts` -> `calibrationValid = true`, `4 / 4` pass `>= 0.95`.
   - Run `npx tsc --noEmit` and `npm test` (`tests/sim-home.test.ts`, `tests/rules.test.ts`, `tests/gait-gate.test.ts`, `tests/tasks.test.ts`).

## Pitfalls to Avoid
- Never measure WebGL pixel diffs via `ctx.drawImage(canvas)` outside `requestAnimationFrame` when `preserveDrawingBuffer` is false — always decode Playwright's compositor `page.screenshot()` PNG buffers instead.
- Respect `AGENTS.md`: simulation files in `tests/sim-home-ceiling.json` may only shrink; any new/expanded planetary simulation logic belongs in `rust/boreal-sim` compiled to `public/wasm/boreal_sim.wasm`, while `src/world/globe/` draw/UI modules, `src/ui/`, `src/style.css`, and `src/main.ts` handle rendering and input.

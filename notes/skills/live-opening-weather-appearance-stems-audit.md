# Skill: Live Opening, Multi-Season Weather, Appearance ShapeTools, & Stems/Music/Library Audit (`live-opening-weather-appearance-stems-audit`)

## Purpose
Verify four end-to-end live gameplay domains in headless Microsoft Edge with zero overlap against prior audits:
1. First-visit Big Bang opening (`?start=sphere&stages=1&trees=v2`), `Escape` skip -> globe entry, and reload persistence while on the globe vs on the ground (`src/main.ts`, `src/world/cosmos/opening.ts`, `src/world/globe/inpage.ts`).
2. Multi-season Kenora phenology (`?date=2026-10-12&hour=14` autumn vs `ref-0`, `?date=2026-04-20&hour=14` spring thaw vs `ref-1`), `Pause -> Graphics -> Weather` toggle/grid persistence (`src/ui/settingsPanel.ts`), and precipitation shading (`src/render/sky.ts`).
3. Appearance Editor direct-manipulation tools (`src/ui/shapeTools.ts`, `src/ui/appearancePanel.ts`) across multi-stroke painting, gradient stop editing, preset saving, `Play as` species availability, and live `G` (`growl`) vs `Photo Gallery` keybinding collisions (`src/camera/gameCamera.ts`).
4. Adaptive music stems (`?stems=1&tones=1`), Music panel `Pulse rate preset` <-> `Pulse rate (Hz)` slider synchronization, WCAG contrast of safety notices and `<select>` controls (`src/style.css`, `src/audio/musicSettings.ts`), `#info` Library dialog accuracy/scroll position (`index.html`), and footer `#export` clickability beneath `#vf-bar`.

## Tools & Workflow
1. Serve the exact target commit on an agent-local Vite port (`agy`: `5250–5269`, never `5173–5209`) with `--strictPort`.
2. Launch headless Microsoft Edge (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) via Playwright; use CDP `Page.captureScreenshot` for non-blocking captures during WebGL/CSS animations and `Page.startScreencast` + `ffmpeg -c:v libvpx` for `recording.webm` (avoiding Playwright's missing bundled ffmpeg on Windows).
3. Always terminate both the headless browser and temporary Vite server in a `finally` block and verify `0` listening sockets remain in `5250–5269`.
4. Generate or source eye-height matched nature references (`ref-0` mid-October Canadian Shield boreal forest; `ref-1` late-April Canadian Shield spring thaw) and inspect every reference before scoring (Rule 6).
5. Run `npx tsx refs/audit/live-opening-weather-appearance-stems-audit/audit.ts` to produce calibrated Rule 11 `numbers.json` (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000`, `calibrationValid = true`).

## Checks That Prove Fixes Work
- **Opening & Return-Visit**: reloading while `inpage.mode === 'globe'` restores `inpageMode === 'globe'` (autosave interval in `main.ts:343` does not overwrite `resume` before `openAfterLoad()` completes); skip saves real oriented globe `lat/lon` (not `lat: 90`); opening shows a subtle skip hint.
- **Seasons & Weather**: Oct 12 shows `>= 5%` golden autumn deciduous canopy + `>= 5%` conifer canopy (`ref-0`); Apr 20 shows patchy thaw snow (`snowCm > 0` or `>= 5%` lower-frame snow) + conifer canopy (`ref-1`); `settingsPanel.ts` listens to both `'input'` and `'change'` so `weather.on` and `weather.quality` persist in `boreal.render.v1`; precipitation `PointsMaterial` modulates brightness with `light.day`.
- **Appearance & `G` Key**: `Paint markings` stays active across multiple strokes and selected gradient stop stays active across colour-wheel/slider edits (preserve `tool` & `stopSel` across `rebuild()` or avoid full DOM teardown); pressing `G` in gameplay triggers `growl` instead of opening empty `#photo-gallery`; Appearance selects have >= 4.5:1 contrast and omit the false world-regen legend; Grizzly bear is either enabled or cleanly wired.
- **Music, Library & Export**: changing `Pulse rate preset` updates both the `Pulse rate (Hz)` slider DOM and persisted `music.pulse`; `.start-panel .note` inside light `<form>` passes WCAG 2.1 AA (`>= 4.5:1`); `Track` `<select>` is readable; `#info` Library matches current Meshy/hunting/Viewfinder mechanics and opens scrolled to `scrollTop = 0`; `#vf-bar` does not overlap `#export` or `#help`, so clicking `#export` downloads valid `boreal-events.json`.

## Mistakes to Avoid
- Never rely on Playwright's `page.screenshot()` during `CosmosSphere` plasma rAF on SwiftShader without CDP fallback — infinite CSS/WebGL animations can stall compositor idle.
- Never forget to test real `page.reload()` while on the globe rather than synthetic `saveResume()` before `page.goto()` (since `pagehide` fires `saveAll()` on navigation).
- Keep all fixes inside allowed UI/render/input/audio TS modules (`AGENTS.md`); verify `tests/sim-home.test.ts` stays green.

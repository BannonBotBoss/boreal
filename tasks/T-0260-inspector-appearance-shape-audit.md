---
id: T-0260
title: Fix hidden Generation Inspector (I), dead terrain picking & 60 Hz gizmo leaks, Appearance capture-phase keydown leak & 3D handle/wheel bugs, CSM-clobbering coat shader, and Genome constraint/handle/fit bugs
author: agy
scratch: false
research: true
skill: inspector-appearance-ui-audit
tags: [ui, inspector, appearance, shader, genome, audit]
credits: 52
---
# T-0260 Generation Inspector (I), Appearance Editor, ShapeTools, Coat Shader & Genome Constraints Audit

Live headless Edge inspection on `origin/main` (`4b7e2c5`, preview port `5268`, `?nomenu&stages=1&trees=v2&noprobe=1&hour=10`, 0 page/console errors) plus calibrated Rule 11 verification (`refs/ui/inspector-appearance-shape-audit/numeric-check.mjs` -> `numbers.json`, `calibrationValid = true`, `0 / 12` checks pass `0.95`, `meanScore = 0.2581`) uncovered four defect groups across `src/ui/inspector.ts`, `src/camera/gameCamera.ts`, `src/render/buildScene.ts`, `src/ui/appearancePanel.ts`, `src/ui/shapeTools.ts`, `src/render/appearance.ts`, and `src/core/genome.ts`.

Credits `52 = 10 × 4 objectives × 1.3` (`scratch: false`, `research: true`: WHATWG DOM EventTarget capture removal spec, W3C Pointer Events Level 3, Three.js r180 WebGLRenderer disposal & CSM `onBeforeCompile` chaining, ITU-R BT.709-6 / IEC 61966-2-1 linear luminance & sRGB transfer function).

Simulation ceiling note (`tests/sim-home-ceiling.json`, PR `#498`): `src/ui/*`, `src/render/*`, and `src/camera/*` are in the allowed draw/input/UI directories; fixes to `src/core/genome.ts` must stay at or below its ceiling line count (or move pure proportion constraint solving into `rust/boreal-sim`).

## Objectives

- [ ] **Make Generation Inspector (`I`) visible, pickable, and leak-free:** stop `src/camera/gameCamera.ts:97` (`body:not(.boreal-debug) #inspector { display: none !important }`) from hiding `#inspector` (`0 × 0 px`) when opened via `I` or `Pause -> More -> Generation inspector (I)` (e.g., toggle `.boreal-debug` or scope the rule to unrequested debug HUDs); restore terrain ground picking in `src/render/buildScene.ts:179,666-675` (include `continuousTerrain` / terrain pick target instead of rejecting `ground.visible = false` and returning `c.root.children[0]` in `lookup('chunk:...')`); fix `src/ui/inspector.ts` 60 Hz GPU material leak in `drawGizmos()` (`:216-220,228,230`) and `toggle(false)` (`:265`), guard `userData.shared` in `freeGeometry()` (`:37`) so What-If previews never dispose cached global tree/rock geometries, read active playable species instead of hardcoding `'Gray wolf'` (`:137-143`), remove the duplicate `chunkSeed` trace (`:63-64`), and detach 3D handles on `toggle(false)`.
- [ ] **Fix Appearance Editor capture-phase `keydown` leak & ShapeTools 3D handle / color-wheel / gradient-stop UX:** pass `capture = true` in `removeEventListener('keydown', keys, true)` at `src/ui/appearancePanel.ts:60` (live test leaked 2 capture listeners across 2 `+ stop` edits, `removedCapture = 0`); fix `src/ui/shapeTools.ts` 3D handles to reject behind-camera projections (`v.z > 1`), handle `pointercancel` so `drag` cannot stick permanently, and allow 3D handles to render/update while editing; fix `hsv()` (`:64,109`) so the 2D color wheel canvas and CSS swatch agree in sRGB (currently `128` vs `188` at `HSV(0, 0.5, 1)` due to `THREE.Color` linear lerp -> sRGB hex round-trip); clear `paintMarks` on `pointerdown`, scale marks by current `(length, height)` in `draw()`, sync stop/alpha/value sliders when selecting a stop, and fix unreadable light-on-white `gradient` `<select>` contrast (`frame-2.png`).
- [ ] **Fix `src/render/appearance.ts` coat shader CSM clobbering & linear luminance blowup:** chain any existing `m.onBeforeCompile` and `o.onBeforeRender` in `inject()` (`:41-59,78-79`) instead of overwriting CSM cascaded shadows (`photoreal.ts`) and `coatFinish.ts`; replace BT.601 sRGB luma `dot(base, vec3(.299, .587, .114)) * 2.` (`:50`) with energy-conserving Rec.709 linear luminance `dot(base, vec3(0.2126, 0.7152, 0.0722))` without the `2×` albedo blowup.
- [ ] **Fix `src/core/genome.ts` constraint enforcement, linear `size` handle scaling, and `fitProfile()` search domain:** in `load(g)` (`:71`), clamp parameters sequentially against the accumulated genome instead of independently against `defaultGenome()` (currently permits `height/length = 0.5556 < 0.70`); in `handleWall()` (`:83`), avoid dividing by `g.size` twice when `param === 'size'` (currently `0.7143` gain at `size = 1.4` instead of `1.0000`); in `fitProfile()` (`:95-104`), search the full schema domain filtered by `CONSTRAINTS` instead of locking `L` to the old `g.height` (currently caps a `1.30 × 1.30` sketch at `1.0714` from `(0.75, 0.75)`) and restore `undo` stack from persisted logs while staying within `tests/sim-home-ceiling.json`.

## Evidence & Calibrated Numbers (Rule 11)

- Live capture frames (`origin/main` `4b7e2c5`, port `5268`): `refs/ui/inspector-appearance-shape-audit/frame-0.png`..`frame-3.png`, `observations.json`.
- Calibrated verification script & output: `refs/ui/inspector-appearance-shape-audit/numeric-check.mjs` -> `numbers.json` (`calibrationValid = true`, knownMatch `>= 0.99`, knownMismatch `<= 0.10`, `0 / 12` pass `0.95`, `meanScore = 0.2581`).

| Check | Measured | Target | Source | Score | Pass |
|---|---|---|---|---|---|
| `#inspector` visible on `KeyI` | `0 px` (`display: none`) | `360 px` | `src/style.css:20` vs `src/camera/gameCamera.ts:97` | `0.000` | no |
| Live ground clicks hitting terrain | `0 / 6` | `6 / 6` | `src/render/buildScene.ts:179,666-675` | `0.000` | no |
| 60 Hz gizmo material & toggle disposal | `0.00` | `1.00` | `src/ui/inspector.ts:216-220,265` (Three.js r180) | `0.000` | no |
| `freeGeometry()` guards `userData.shared` | `0` | `1` | `src/ui/inspector.ts:37` vs `src/render/geometry.ts` | `0.000` | no |
| Dynamic player species readout | `0` (`Gray wolf`) | `1` | `src/ui/inspector.ts:137-143` vs `src/render/playables.ts` | `0.000` | no |
| Capture-phase `keydown` listeners leaked (2 edits) | `2` | `0` | WHATWG DOM §2.7 vs `src/ui/appearancePanel.ts:60,64` | `0.000` | no |
| 3D handle guards (`v.z>1`, `pointercancel`, detach) | `0.00` | `1.00` | W3C Pointer Events L3 vs `src/ui/shapeTools.ts:31-53` | `0.000` | no |
| `load()` `height/length` ratio enforcement | `0.5556` | `>= 0.70` | `src/core/genome.ts:32,71` (`CONSTRAINTS`) | `0.794` | no |
| `handleWall('size')` linear gain at `size=1.4` | `0.7143` | `1.0000` | `src/core/genome.ts:80-85` | `0.714` | no |
| `fitProfile()` reach to `(1.30, 1.30)` from `(0.75, 0.75)` | `1.0714` | `1.3000` | `src/core/genome.ts:95-104` | `0.824` | no |
| Coat shader CSM chain & Rec.709 luminance (no `2×`) | `0.00` | `1.00` | ITU-R BT.709-6 / `src/render/appearance.ts:41-59` | `0.000` | no |
| Color wheel canvas vs CSS swatch byte at `HSV(0,0.5,1)` | `128` | `188` | IEC 61966-2-1 sRGB / `src/ui/shapeTools.ts:64,109` | `0.765` | no |

## What the Live Frames Show
- `frame-0.png`: After pressing `I`, `#inspector` is in the DOM with `hidden = false` and `body.inspecting = true`, yet invisible (`computed.display = "none"`, `0 × 0 px`) due to `src/camera/gameCamera.ts:97`.
- `frame-1.png`: Six ground clicks across the visible steppe return `0 / 6` terrain hits because `buildScene.ts:179` sets `ground.visible = false` and `pick()` skips hidden meshes while omitting `continuousTerrain`.
- `frame-2.png` & `frame-3.png`: Opening `Pause -> More -> Appearance` shows the 2D silhouette canvas with disconnected floating paw dots, unreadable light-on-white `gradient: length` `<select>`, overlapping bottom hint text over the controls footer, missing 3D blue drag handles on the paused wolf, and `2` permanently leaked capture-phase `keydown` listeners after 2 `+ stop` clicks (`removedCapture = 0`).

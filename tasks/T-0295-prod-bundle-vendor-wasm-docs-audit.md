---
id: T-0295
title: Fix 21.71 MB dist/assets bloat & eager 5.92 MB VR chunk fetch on desktop boot, vendor/detect-gpu missing sourcemap/CDN default/RTX 5060 & 4 uncalled Rust WASM exports, 23 non-sim render/UI files trapped in sim-home-ceiling.json & dead src/render/fur.ts, and PROJECT-RULES/docs/OpenStax CC BY-NC-SA drift
author: agy
scratch: false
research: true
skill: prod-bundle-vendor-wasm-docs-audit
tags: [build, bundle, vite, vr, vendor, wasm, rules, docs, licence, audit]
credits: 52
---
# Fix `21.71 MB` `dist/assets/` bloat & eager `5.92 MB` VR chunk fetch on desktop boot, `vendor/detect-gpu` missing sourcemap/CDN default/RTX 5060 & `4` uncalled Rust WASM exports, `23` non-sim render/UI files trapped in `sim-home-ceiling.json` & dead `src/render/fur.ts`, and `PROJECT-RULES`/docs/OpenStax `CC BY-NC-SA` drift

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
- When the game is built for players (`npm run build`), the bundle weighs `65.10 MB` (`21.71 MB` of code and libraries alone) and downloads a `5.92 MB` headset-only VR library on every ordinary desktop visit before anyone clicks **Enter VR**.
- Half of the built `dist/assets/` folder (`11.95 MB`) is unused extras: `18` unused Google/UIKit font packs (`7.14 MB`), an unused Havok physics engine (`2.09 MB`), unused Draco/Basis 3D decoders (`1.90 MB` — zero shipped `.glb` models use them), and `40` legacy `.ttf`/`.woff` math font duplicates (`817 KB`).
- Inside the code hygiene and hardware checks, the vendored GPU detector points at a missing source map and a public CDN default while omitting RTX 5060/5070/5090 rows, four exported Rust simulation helpers (`engine_panic_ptr`/`len`, `species_density`, `species_spawn_count`) are never wired into TypeScript, `23` pure drawing/UI files are trapped on the simulation line ceiling alongside a dead `fur.ts` shader file, and several project rule/design documents contradict what ships today (including a non-commercial OpenStax quiz licence warning).
- What stays the same: all mouse, keyboard, and gamepad controls, Rust simulation ownership, and WebXR VR entry when the player actually clicks **Enter VR**.
- Decision for Matthew: (A) Should we replace the `CC BY-NC-SA 4.0` OpenStax physics questions in `src/data/quizzes/constant.G.json` with original public-domain / CC0 questions before any commercial or paid distribution? (Yes / No)

## Detailed findings (`origin/main` `9cc43b97`, zero overlap with `T-0001..T-0294`)
Production `npm run build` (`vite build` + `--base=/boreal/` GitHub Pages build), live headless Edge preview (`1280×720`, SwiftShader, temporary local static server on port `5262`, cleanly closed in `finally` with `0` remaining sockets, `0` console/page errors, `0` HTTP 404s, `recording.webm = 73,521 B`, `3` live PNG frames vs `2` matched natural references), WebAssembly binary export inspection, and calibrated Rule 11 verification (`refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts` -> `numbers.json`, `calibrationValid = true`, `0 / 4` checks pass `>= 0.95`, `meanScore = 0.1417`) uncovered four coupled production-bundle, vendor/WASM, guardrail, and governance-documentation defects:

1. **Production `vite build` Bundle Bloat (`65.10 MB` `dist/`, `21.71 MB` `dist/assets/`) & Eager `5.92 MB` VR Download on Desktop (`src/main.ts:376`, `package.json`, missing `vite.config.ts`)**:
   - **Desktop boots eagerly download `5.92 MB` of VR code**: `src/main.ts:376` executes `void import('./vr/session').then(m => m.mountEnterVr(...))` on every page load just to attach a click listener to `#vr-btn`. Live production network telemetry (`live-capture.json` `forest.topRequests[0]`) proves `/assets/session-zmBZrAFV.js` (`5,917,698 B`, `1.51 MB` gzip) is fetched with HTTP `200` on a plain desktop non-VR visit — the single largest network download on the page, larger than `world.js` (`973.8 KB`), `main.js` (`879.1 KB`), `boreal_sim.wasm` (`418.9 KB`), and every animal `.glb` combined.
   - **`11.95 MB` (`55.0%`) of `dist/assets/` (`21,706,088 B`) is completely unused in production**:
     - `18` IWSDK UIKit font/MSDF chunks (`raleway` `660 KB`, `playfairDisplay` `559 KB`, `nunito` `542 KB`, `merriweather` `507 KB`, `montserrat` `467 KB`, `msdf-worker` `456 KB`, `inter` `423 KB`, `firaCode` `416 KB`, `workSans` `404 KB`, `roboto` `399 KB`, `poppins` `396 KB`, `sourceCodePro` `393 KB`, `openSans` `392 KB`, `inconsolata` `375 KB`, `lato` `241 KB`, `crimsonText` `226 KB`, `libreBaskerville` `192 KB`, `spaceMono` `93 KB`) = **`7,140,628 B` (`7.14 MB`)**, while `src/vr/journey.ts:265` renders UI via `CanvasTexture` `'18px sans-serif'`.
     - `HavokPhysics-BqNY-4N9.wasm` = **`2,094,563 B` (`2.09 MB`)** (`100%` unused; Boreal uses `src/proc/physics.ts` + `rust/boreal-sim`).
     - `7` Draco/Basis decoder assets (`draco_decoder.js` `719 KB`, `basis_transcoder.wasm` `527 KB`, plus two separate `draco_decoder-*.wasm` files `286 KB` & `192 KB`) = **`1,899,658 B` (`1.90 MB`)**, even though binary glTF header inspection proves **`0 / 26`** shipped `.glb` models use Draco (`KHR_draco_mesh_compression`) or KTX2 (`KHR_texture_basisu`).
     - `40` redundant legacy `.ttf` (`20` files, `513.7 KB`) and `.woff` (`20` files, `303.1 KB`) KaTeX font files = **`816,780 B`**, duplicating the `19` `.woff2` (`256.2 KB`) files already supported by 100% of WebGL2/WebXR browsers.
   - **Build hygiene**: No `vite.config.ts` exists; **`8` JS chunks exceed `500 kB`** (up to `5.92 MB`); Vite emits **`2` mixed static/dynamic import warnings** (`src/render/simWasm.ts` dynamic in `planetBudget.ts` vs static in `driveBridge.ts`/`orbitVeg.ts`/`litterBridge.ts`; `src/animals/locomotion/game.ts` dynamic in `borealSound.ts` vs static in `playables.ts`); `iwer` (`^2.7.0`) in `package.json` `devDependencies` has **`0` references** across `src/`, `tests/`, and `tools/`; and the `--base=/boreal/` GitHub Pages build still embeds hardcoded `'/bake/earth-hot'` (`globeView-*.js`), `'cinematic/refs/'` (`main-*.js`), and `'https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks'` (`main-*.js`).

2. **`vendor/` Third-Party Libraries (`54` Files, `153.96 KB`) & `public/wasm/boreal_sim.wasm` (`418.9 KB`, `49` Exports) Parity**:
   - `vendor/detect-gpu/index.js:2` ends with `//# sourceMappingURL=detect-gpu.esm.js.map` pointing to a **non-existent `.map` file**, and line 1 hardcodes `benchmarksURL = "https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks"` (which lands inside `dist/assets/main-*.js`, contradicting `AGENT-NOTES.md:152` "no runtime CDN fetch" if any caller omits `benchmarksURL`).
   - `public/detect-gpu/d-nvidia.json` (`v5`) lists only **`1` RTX 50-series row** (`"nvidia geforce rtx 5080"`) — zero entries for RTX 5060 / 5060 Laptop / 5070 / 5090 (explaining `src/core/probe.ts:31`'s note that Matthew's RTX 5060 Laptop fell back to Tier 1).
   - While `public/wasm/boreal_sim.wasm` (`49` function exports) matches `rust/boreal-sim/src/**/*.rs` (`49` `pub extern "C" fn` declarations, `0` missing / `0` extra), **`4` Rust WASM exports are completely unwired in `src/`**:
     - `engine_panic_ptr` and `engine_panic_len` (`rust/boreal-sim/src/lib.rs:276–277`): Rust panic diagnostics exist in WASM memory but TypeScript never reads or logs them.
     - `species_density` and `species_spawn_count` (`rust/boreal-sim/src/lib.rs:134–138`): Rust species-density/spawn-count evaluators exist in WASM but `src/` never calls them.

3. **`tests/sim-home-ceiling.json` & `tests/rules.test.ts` Guardrail Drift**:
   - **`23` pure rendering, UI, GLSL, canvas, and dev-harness files are trapped inside `tests/sim-home-ceiling.json`** (`src/core/asset.ts` [4 lines], `src/proc/glsl.ts` [58], `src/world/globe/{globeView.ts [851], atmosphere.ts [410], horizonSkirt.ts [297], orbitAlbedo.ts [175], axisView.ts [137], aerialExemplar.ts [94], tilingBlend.glsl.ts [63], farLayerDemo.ts [56], layerPanel.ts [51], startView.ts [19], entry.ts [10], hud.ts [6]}`, `src/world/cosmos/{opening.ts [685], sphere.ts [555], cineBeats.ts [505], cineReady.ts [64], look.ts [52]}`, `src/world/sun/sunView.ts [108]`, `src/animals/locomotion/lab.ts [204]`, plus budget shims) solely because of their folder path rather than simulation ownership — blocking legitimate WebGL/DOM draw & UI fixes under `AGENTS.md` unless those view files are relocated to `src/render/` / `src/ui/` / `src/dev/`.
   - **`3` stale ceilings (`12` slack lines)** remain in `tests/sim-home-ceiling.json` (`world/globe/orbitAlbedo.ts` `168/175`, `core/planetBudget.ts` `241/245`, `world/globe/openTiles.ts` `435/436`), allowing TypeScript simulation files to grow silently back up to those stale limits.
   - **`src/render/fur.ts` (`63` lines) is `100%` dead code** (`0` importers anywhere in `src/`, annotated `"fur.ts: dead, awaiting Claude's OK to delete"` in `tests/rules.test.ts:30` since Oct 15, 2026) and `tests/rules.test.ts` still carries **`18` legacy allowlist entries** across `6` static guards (duplicate sin-hash, duplicate GLSL noise, `8` species-named files, literal `9.81`, literal `massKg`, and `4` literal-constant files).

4. **Governance, Spec & Licence Documentation Drift + Live Production Visual Fidelity (`PROJECT-RULES.md`, `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, `CHALLENGES.md`, `docs/{constants,rendering-map}.md`, `src/data/{controls.json,quizzes/constant.G.json}`)**:
   - `PROJECT-RULES.md:38–39` (Rule 1) exempts only `public/models/animals/manifest.json` (`21` Meshy GLBs), omitting the **`5` shipped tree GLBs** (`public/models/trees/*.glb`, Kenney CC0) loaded by `src/render/trees/cc0Impostors.ts`.
   - `src/data/quizzes/constant.G.json:3,414` ships **`27` OpenStax problems under `CC BY-NC-SA 4.0`** with an inline legal warning (*"OpenStax requires prior written permission for use in generative-AI offerings or commercial use. Do not ship in a paid build"*), while **`9 / 10` gated controls** in `src/data/controls.json` remain `"quiz": "todo"` (`layer.atmosphere`, `layer.clouds`, `layer.magnetosphere`, `layer.aurora`, `layer.plates`, `camera.exposure`, `camera.filters`, `time.rate`, `deeptime.seed`).
   - Concrete path/fact drift across docs: `docs/constants.md:26` cites non-existent `data/controls.json` (actual: `src/data/controls.json`); `docs/rendering-map.md:49` cites `waterMaterial` in `src/render/pbr.ts` (actual: `src/render/water.ts`); `SKELETON-RULES.md:116,123` cites dead `src/render/fur.ts` and claims *"The deer and other animals still use the old boxes"*; `ANIMAL-BEHAVIOUR.md:3,11,32` claims *"Current animals: deer and player wolf"*, *"Forage berry patches ... are the only thing animals sense as food"*, and *"the player starts at the origin"*; `CHALLENGES.md:9` specifies `core/life.ts` / `stepLife` which does not exist (`rust/boreal-sim/src/drives.rs` and `src/core/needs/` replaced it).
   - Live production `dist/` visuals (`frame-0..2.png`, `recording.webm = 73,521 B`) still fail the 95% natural reference gate against `reference/ref-0..1.jpg`.

## Evidence and cause
Reproduced deterministically via `npx tsx refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts` -> `refs/audit/prod-bundle-vendor-wasm-docs-audit/numbers.json`, backed by live headless Edge preview of both `dist/` (`/`) and `dist-pages/` (`/boreal/`) on temporary port `5262` (`0` console/page errors, `0` HTTP 404s, browser closed in `finally`, server closed cleanly):
- `calibrationValid`: **`true`** (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000` on all 4 checks)
- `passCount`: **`0 / 4`**, `meanScore`: **`0.1417`**
- Live screen recording: `refs/audit/prod-bundle-vendor-wasm-docs-audit/recording.webm` (`73,521` B, VP8 WebM production `dist/` forest walk & turn)
- Live production frames vs matched natural references:
  - `frame-0-prod-dist-forest-boot.png` vs `reference/ref-0-boreal-wolf-pack-forest-reference.jpg`
  - `frame-1-prod-pages-base-boreal-globe.png` vs `reference/ref-1-earth-orbit-boreal-limb-reference.jpg`
  - `frame-2-prod-dist-data-panel-katex.png` (production `dist/` Data Panel `U` with `68` KaTeX nodes & Rust engine spawn log)

### Nature-checked & spec-checked number table
| Quantity | Game (`origin/main` `9cc43b97`) | Nature / Spec Target + Source | Score | Pass? |
|---|---|---|---:|---|
| Production `dist/assets/` bundle & desktop eager VR boot | `dist/` `65.10 MB` (`dist/assets/` `21.71 MB`); desktop boot eagerly fetches `/assets/session-zmBZrAFV.js` (`5.92 MB`); `11.95 MB` (`55.0%`) unused assets (`7.14 MB` `18` UIKit fonts, `2.09 MB` `HavokPhysics.wasm`, `1.90 MB` Draco/Basis decoders for `0/26` GLBs, `817 KB` `.ttf`/`.woff` KaTeX duplicates); `8` chunks > `500 KB`; `0` `vite.config.ts`; `2` static/dynamic import warnings; unused `iwer` | `0 B` VR chunk fetched until **Enter VR** click; `0 B` unused UIKit fonts/Havok/Draco decoders; `.woff2`-only KaTeX (`256 KB`); Vite `manualChunks` `< 500 KB` (Vite / Web.dev performance budget); `0` import warnings & `0` unused deps | `0.0000` | No |
| `vendor/` (`6` libs, `154 KB`) & `public/wasm/boreal_sim.wasm` (`49` exports) | Missing `detect-gpu.esm.js.map` (`sourceMappingURL`); `unpkg.com` CDN default bundled in `main-*.js`; `d-nvidia.json` has `1` RTX 50 row (`5080`, `0` `5060`/`5070`/`5090`); `49/49` Rust↔WASM exports match, but `4` exports (`engine_panic_ptr/len`, `species_density`, `species_spawn_count`) have `0` callers in `src/` | `0` broken sourcemaps, local-only benchmarks default (`AGENT-NOTES.md:152`), RTX 5060/5070/5090 coverage, `100%` Rust↔WASM export match with panic & species-density bridge wired (`AGENTS.md`) | `0.1667` | No |
| `tests/sim-home-ceiling.json` (`219` files) & `tests/rules.test.ts` | `23` pure render/UI/GLSL/DOM view files trapped in `sim-home-ceiling.json`; `3` stale ceilings (`12` slack lines); `100%` dead `src/render/fur.ts` (`0` importers); `18` legacy allowlist entries in `rules.test.ts`; `0` over-ceiling files | View/UI/GLSL files live in `src/render`/`src/ui`/`src/dev` (`AGENTS.md`); `0` stale ceiling slack; dead `fur.ts` deleted; legacy allowlist shrinking cleanly | `0.2000` | No |
| Governance/spec/licence docs & live prod visuals (`frame-0..2`, `recording.webm`) | `0` console errors & `0` 404s on initial load; `PROJECT-RULES.md` omits `5` tree GLBs; `constant.G.json` ships `CC BY-NC-SA 4.0` OpenStax (`9/10` other controls `todo`); wrong paths in `docs/constants.md` & `docs/rendering-map.md`; stale `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, `CHALLENGES.md`; `frame-0..2` fail 95% visual gate vs `ref-0..1` | Docs match live repo & `AGENTS.md`/Rule 18; permissive/original quiz pools for all `10` controls; `>= 95%` natural visual match to `ref-0..1.jpg` & uncluttered Data Panel (Rules 6, 11) | `0.2000` | No |

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**
  - `frame-0-prod-dist-forest-boot.png` (`dist/` production build `/?nomenu=1&seed=1400&noprobe=1&stages=1&trees=v2`, `1280×720`): A completely flat, untextured uniform mustard-brown ground plane meeting a pale blue-white cloudy sky at a straight horizontal horizon. Four spindly dark vertical tree poles with thin horizontal parallel green herringbone/ladder slats stand on the left against the sky, plus one faceted dark-green low-poly cone on the right. Top-left `"Data (U)"` clips `"PROCEDURAL WORLD / 01"`, top-right `"Explore"` collides directly with `"08:04 · WALK ..."`, and bottom-right `"Camera | Photo | Gallery"` overlaps `"Export events"` and `"Library / controls"`.
  - `frame-1-prod-pages-base-boreal-globe.png` (`dist-pages/` `--base=/boreal/` build `/boreal/?view=globe&seed=1400&noprobe=1&stages=1`): An illuminated planetary disc against black space with blurry brown-tan/dark-green `39.1 km/px` continental masses (Africa/Arabia/Eurasia) underneath thick opaque flat white cloud patches, a sharp black night terminator, and 11 raw unstyled blue browser checkboxes stacked in the top-right corner.
  - `frame-2-prod-dist-data-panel-katex.png` (`dist/` after walking forward in `recording.webm` and pressing `U`): Sparse yellow-green triangular grass clusters appear in the foreground with the grey wolf head and brown pups dimly visible mid-frame inside a white ring, while the dark `"What is running"` Data Panel fills the right half, displaying `Time (cycles): 61.90739428829973` and a 13-line `Spawn log` (`spacetime`, `reheating`, `planet`, `climate`, `solar`, `energy`, `wind`, `hydro`, `clouds`, `hunger`, `senses`, `prey`, `danger`) that pushes all `68` rendered KaTeX equations off-screen below the fold while covering `#status`, `#interaction`, and the right footer buttons.
- **Does that look natural as described? How do I know?**
  - **No.** Compared against `reference/ref-0-boreal-wolf-pack-forest-reference.jpg`, a real Canadian Shield boreal forest floor is richly layered with green moss, pale reindeer lichen, fallen conifer needles, twigs, and weathered granite under dense layered spruce and white paper birch trees with soft paw contact shadows — not a flat mustard-brown plane with ladder-like tree poles. Compared against `reference/ref-1-earth-orbit-boreal-limb-reference.jpg`, real Earth from orbit shows crisp coastal/lake topography, translucent textured cloud decks, and a fine Rayleigh blue limb without raw browser checkboxes.
- **Does what I see in the game resemble the reference to 95%, in timing and position?**
  - **No** (`meanScore = 0.1417`, `0 / 4` calibrated checks pass `>= 0.95`).

## Objectives
- [ ] Eliminate production `dist/assets/` bloat (`11.95 MB` unused) and eager `5.92 MB` VR download on desktop (`src/main.ts:376`, new `vite.config.ts`, `package.json`, `src/core/planetBudget.ts`, `src/audio/borealSound.ts`): move `#vr-btn` click registration into `main.ts` so `./vr/session` (`5.92 MB`) is dynamically imported *only* when the player clicks **Enter VR**; configure `vite.config.ts` (`manualChunks` + asset pruning/tree-shaking) to strip unused `@iwsdk/core` UIKit font packs (`7.14 MB`), unused `HavokPhysics.wasm` (`2.09 MB`), unused Draco/Basis decoders (`1.90 MB`, `0/26` GLBs use them), and legacy `.ttf`/`.woff` KaTeX font duplicates (`817 KB`, keeping `.woff2`); resolve the `2` mixed static/dynamic import warnings (`simWasm.ts`, `animals/locomotion/game.ts`); remove unused `iwer` from `package.json`; and verify `0` chunks > `500 kB` and `0` hardcoded root/CDN paths in `--base=/boreal/` builds.
- [ ] Fix `vendor/detect-gpu` and wire remaining Rust WASM exports (`vendor/detect-gpu/index.js`, `public/detect-gpu/d-nvidia.json`, `src/render/simWasm.ts`, `src/core/landingRoster.ts` or Rust bridge): strip the broken `sourceMappingURL=detect-gpu.esm.js.map` comment and remove the `unpkg.com` CDN default from `vendor/detect-gpu/index.js` so offline/local benchmarks are always enforced; add RTX 5060 / 5060 Laptop / 5070 / 5090 benchmark rows (or versioned refresh) to `public/detect-gpu/d-nvidia.json`; and wire the `4` currently uncalled Rust WASM exports (`engine_panic_ptr`, `engine_panic_len`, `species_density`, `species_spawn_count`) into TypeScript with unit tests.
- [ ] Clean up `tests/sim-home-ceiling.json` and `tests/rules.test.ts` guardrail drift: relocate the `23` pure draw/UI/GLSL/DOM view files (or carve explicit draw-only directories per `AGENTS.md`) so `tests/sim-home-ceiling.json` tracks genuine simulation files only, tighten the `3` stale ceiling entries (`12` slack lines: `orbitAlbedo.ts`, `planetBudget.ts`, `openTiles.ts`) to exact line counts, delete dead `src/render/fur.ts` (`0` importers) and remove it from `tests/rules.test.ts`, and retire remaining allowlisted legacy violations where Rust/shared replacements exist.
- [ ] Reconcile governance, spec, and quiz-licence documentation (`PROJECT-RULES.md`, `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, `CHALLENGES.md`, `docs/constants.md`, `docs/rendering-map.md`, `src/data/controls.json`, `src/data/quizzes/`): document `public/models/trees/*.glb` in `PROJECT-RULES.md` Rule 1; resolve the `CC BY-NC-SA 4.0` OpenStax commercial/AI restriction in `src/data/quizzes/constant.G.json` (with Matthew's decision) and source permissively licensed pools for the `9` `"todo"` controls; fix wrong paths in `docs/constants.md:26` (`src/data/controls.json`) and `docs/rendering-map.md:49` (`src/render/water.ts`); update `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, and `CHALLENGES.md` to match the live Rust + Meshy/procedural architecture; and verify `npm run build`, `npm test`, `npx tsc --noEmit`, `notes/skills/prod-bundle-vendor-wasm-docs-audit.md`, and `>= 0.95` across all `4` calibrated checks in `refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts`.

## Relevant files
- `src/main.ts`
- `src/vr/session.ts`
- `package.json`
- `tsconfig.json`
- `src/core/planetBudget.ts`
- `src/audio/borealSound.ts`
- `src/render/simWasm.ts`
- `vendor/detect-gpu/index.js`
- `public/detect-gpu/d-nvidia.json`
- `public/wasm/boreal_sim.wasm`
- `rust/boreal-sim/src/lib.rs`
- `tests/sim-home-ceiling.json`
- `tests/sim-home.test.ts`
- `tests/rules.test.ts`
- `src/render/fur.ts`
- `PROJECT-RULES.md`
- `SKELETON-RULES.md`
- `ANIMAL-BEHAVIOUR.md`
- `CHALLENGES.md`
- `docs/constants.md`
- `docs/rendering-map.md`
- `src/data/controls.json`
- `src/data/quizzes/constant.G.json`
- `refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts`
- `refs/audit/prod-bundle-vendor-wasm-docs-audit/numbers.json`

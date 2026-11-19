---
id: T-0266
title: Fix floating 4x-wide & >1.0-albedo grass blades, bare-rock/cliff grass override, 0.35-capped midwinter snowpack & skirt seams, and late-ground loading handoff
author: agy
scratch: false
research: true
skill: floor-grass-snow-landing-audit
tags: [render, terrain, grass, snow, startup, ui]
credits: 52
---
# Fix floating `4×`-wide & `> 1.0`-albedo grass blades, bare-rock/cliff grass override, `0.35`-capped midwinter snowpack & skirt seams, and late-ground loading handoff

Status: proposed, unclaimed. Needs another agent's `approve-plan`. Credits = `10 x 4 objectives x (1 + 0.3 research) = 52`.

## Plain-English summary
Live headless Chromium (`1280×720`, SwiftShader, `0` console/page errors) and calibrated Rule 11 inspection of `origin/main` (`a3828c7`, immediately after `#514`, `#517`, `#518`, `#510`, and `#521` landed) against side-by-side boreal nature references uncovered four distinct regressions and visual/safety gaps:
1. **Grass blades float `+3.0 cm` above the soil, inflate to `24–72 mm` wide plastic confetti ribbons, and exceed `1.0` linear reflectance in autumn**: `#517` (`30fe3b0`) shifted every blade root from `ground(x, z) - 0.01` to `ground(x, z) + 0.03` (`src/render/grass/cover.ts:130`, mean `+2.94 cm` over `500` sampled blades — `23%–60%` of *Danthonia*/*Deschampsia* blade length hovering in mid-air), multiplied near blade width by `4.0×` (`src/render/grass/grass.ts:108`: *Calamagrostis canadensis* `6 mm` -> `24 mm` near, up to `72 mm` far vs `3–8 mm` in FNA vol. 24), and multiplied already-calibrated PROSPECT linear albedos by `2.6×` (`grass.ts:135`: summer tip green `0.718`, autumn red `1.461 > 1.0`, violating energy conservation and creating glowing orange confetti flecks in `frame-3-autumn-grass-albedo.png`).
2. **Bare granite outcrops and steep `> 40°` cliffs are forcibly carpeted with `38%` grass**: `#514` (`e8ff370`) added an unconditional fallback in `viewedCover()` (`src/render/grass/cover.ts:89-91`) that replaces any dry cell with `local.density < 0.08` with `density = 0.38`, overriding `470 / 470` (`100.0%`) of bare Shield bedrock pockets and `> 40°` cliffs where `defaultCover()` intentionally returned `0`.
3. **Midwinter snowpack is hard-capped at `snowPaint = 0.35` (`78.9%` bare dirt) with uncopied `aSnow = 0` LOD skirts, directly contradicting white winter grass**: `#517` (`30fe3b0`) capped `snowPaint(depthCm) = Math.min(0.35, depthCm / 40)` (`src/render/continuousTerrain.ts:132-135`), so even at `50 cm` (Kenora January–March normal) or `120 cm` snowpack, `pbr.ts:70` (`smoothstep(0.2, 0.8, vSnow + (n2 - 0.5) * 0.4)`) averages only `0.2109` (`78.9%` bare ground!) while `grass.ts:138-139` turns blades `100%` paper-white `vec3(0.8)`. Furthermore, `continuousTerrain.ts:220-226` omits `snow[i] = snow[src]` on all LOD skirt vertices (leaving `aSnow = 0` seams at every quadtree transition), and `frame-2-midwinter-snow-deficit.png` (Jan 25, HUD `Snow 33.5 cm`) renders **`0.1%` snow-white pixels and `98.0%` dark olive/brown ground** (`meanRGB = [62, 64, 36]`) underneath white grass ribbons — the exact inverse of `reference/ref-2-midwinter-boreal-snow.jpg`.
4. **Late-ground loading-card recovery drops the player into an unbuilt void, disables chunk-priority budgeting during the wait, polls the wrong coordinate for `?at=`, and leaves `loading.ts` timers uncancelled**: `#521` (`57ddc10`, `src/main.ts:813-822`) polls up to `90 s` when `startup()` returns `ground = false`, but `startup.ts:215` already reset `splashChunks = false` in `finally` (so `splashChunkBudget()` is off during the entire 90 s recovery wait), `main.ts:818` polls `standChunkIndex(player.x, player.z)` instead of `standPoint(location.search, view.livingHere())`, `main.ts:821` unconditionally calls `loading.finish(); openAfterLoad(q)` even if the standing chunk STILL never arrived after `90 s`, and `src/ui/loading.ts:31-35` never stores/cancels its `setTimeout(tick, 500)` handle on `finish()`.

*(Scope note: zero overlap with `T-0226` multi-year phenology/Southern Hemisphere, `T-0230` cryosphere/lake-ice/precipitation, `T-0248` `continuousMaterial().clone()` dropping `terrainMaterial().onBeforeCompile` / nocturnal `STYLIZED` emissive / `steppeTuft` curing & `8 m` radius / `addTranslucency` shadow & tree wind shear, or `T-0257` globe resume/save/governor/deltas/rewind. All fixes for `T-0266` belong strictly in allowed draw/UI/startup directories `src/render/grass/`, `src/render/continuousTerrain.ts`, `src/render/pbr.ts`, `src/render/startup.ts`, `src/ui/loading.ts`, `src/main.ts`, and `tests/` — zero growth to `tests/sim-home-ceiling.json` and zero simulation added outside Rust.)*

## Evidence and frame analysis
- **Reproducible audit script & calibrated report**: `refs/terrain/floor-grass-snow-landing-audit/audit.ts` -> `refs/terrain/floor-grass-snow-landing-audit/numbers.json` (`baseCommit = a3828c7`, `calibrationValid = true`, `0 / 6` checks pass `>= 0.95`, `meanScore = 0.0465`, `0` console/page errors).
- **Sampled live frames (`1280×720`, SwiftShader)**:
  - `refs/terrain/floor-grass-snow-landing-audit/frame-0-summer-floor-grass.png` (`day=227`, `hour=10`, Aug 15): Wolf & pups on flat khaki ground with wide stubby triangular green ribbons (`24–72 mm` wide) floating `+3 cm` above the surface.
  - `refs/terrain/floor-grass-snow-landing-audit/frame-1-close-grass-roots.png` (pitched closer to dry standing floor): Confetti-like wide crossed blades hovering above khaki soil in mid-ground behind the pack.
  - `refs/terrain/floor-grass-snow-landing-audit/frame-2-midwinter-snow-deficit.png` (`day=25`, `hour=11`, Jan 25, HUD `Snow 33.5 cm`): Ground band is `98.0%` dark olive-brown (`meanRGB = [62, 64, 36]`, `0.1%` white) while mid-ground crossed grass ribbons are pure paper-white (`vec3(0.8)`).
  - `refs/terrain/floor-grass-snow-landing-audit/frame-3-autumn-grass-albedo.png` (`day=285`, `hour=10`, Oct 12): Glowing neon-orange/red speckles (`fall R = 1.461 > 1.0`) scattered across flat brown-tan ground.
- **Generated boreal nature references (Step 2)**:
  - `refs/terrain/floor-grass-snow-landing-audit/reference/ref-0-summer-boreal-floor.jpg`: Slender 3–8 mm green/tan grass culms rooted seamlessly into conifer needle duff & moss, with bare weathered Shield rock staying grass-free.
  - `refs/terrain/floor-grass-snow-landing-audit/reference/ref-2-midwinter-boreal-snow.jpg`: Continuous crisp white winter snowpack blanketing the entire floor and hills under 33 cm snow, with sparse dark dry grass tips poking cleanly out of the snow.
  - `refs/terrain/floor-grass-snow-landing-audit/reference/ref-3-autumn-boreal-floor.jpg`: Muted matte cured-tan sedges and subdued rust-red blueberry foliage rooted in needle litter (no glowing neon orange).
- **Resemblance verdict**: Game frames do **not** resemble the nature references to `95%` (`0 / 6` calibrated checks pass; `frame-2` is the literal luminance inverse of `ref-2-midwinter-boreal-snow.jpg`).

### Nature-checked number table
Sources:
- *Flora of North America* (FNA) vol. 24 (*Calamagrostis canadensis* leaf width `3–8 mm`; *Deschampsia flexuosa* `0.3–1 mm`, length `5–20 cm`; *Danthonia spicata* `1–3 mm`, length `6–15 cm`, basal culm insertion into soil/litter); FNA vol. 8 (*Vaccinium angustifolium* leaf width `6–12 mm`).
- Jacquemoud, S. & Baret, F. (1990), "PROSPECT: A model of leaf optical properties spectra", *Remote Sens. Environ.* 34(2):75–91 (green leaf VIS peak reflectance `0.10–0.35`, passive Lambertian surface reflectance strictly `<= 1.0`).
- Baldwin, K. A. & Sims, R. A. (1997), *Field Guide to the Common Forest Plants in Northwestern Ontario*, OMNR (bare Shield bedrock outcrops carry crustose/reindeer lichen, not `38%` graminoid cover).
- Wiscombe, W. J. & Warren, S. G. (1980), "A model for the spectral albedo of snow. I: Pure snow", *J. Atmos. Sci.* 37:2712–2733; Baker, D. G. et al. (1991), *J. Climate* 4:721–732; Environment and Climate Change Canada Kenora 1981–2010 climate normals (January–March mean snow depth `40–60 cm`; optically thick continuous snowpack `>= 0.95` cover achieved by `10–15 cm` depth).

Calibration (`refs/terrain/floor-grass-snow-landing-audit/numbers.json`): every metric uses `ratioScore` or `deltaScore` / bounded linear scoring calibrated to `knownMatchScore >= 0.95` (`0.9948–1.0000`) and `knownMismatchScore = 0.0000` (`< 0.75`).

| Quantity | Game (`origin/main` `a3828c7`) | Nature / Spec Target | Calibrated Score | Resembles nature? |
|---|---:|---:|---:|---|
| Grass blade basal root vertical offset above terrain (`cover.ts:130`) | `+3.0 cm` (mean `+2.94 cm` over `500` blades) | `<= 0.0 cm` (`-1..0 cm` rooted in soil/litter, FNA vol. 24) | `0.0000` | **NO** (every blade floats 3 cm in mid-air) |
| Grass near blade width (`Calamagrostis`, `grass.ts:108`) & linear albedo energy conservation (`grass.ts:135`) | `24.0 mm` near (`72.0 mm` far, `4×` mult); `2.6×` albedo -> summer G `0.718`, fall R `1.461 > 1.0` | `<= 8.0 mm` (FNA vol. 24); leaf VIS `<= 0.35` / `<= 1.0` (PROSPECT 1990) | `0.1667` | **NO** (`3–9×` wide ribbons + non-physical `> 1.0` reflectance) |
| Midwinter `50 cm` snowpack `pbr.ts` mean snow cover & LOD skirt `aSnow` copy (`continuousTerrain.ts:132,220-226`) | `snowPaint(50 cm) = 0.35` -> mean `0.2109` (`78.9%` bare dirt); `skirtCopiesSnow = false` | `>= 0.95` continuous snowpack (`>= 15–50 cm`, Wiscombe & Warren 1980) & `skirtCopiesSnow = true` | `0.1110` | **NO** (midwinter snow permanently capped at dusting; dark LOD skirt seams) |
| Bare bedrock outcrops & `> 40°` cliffs keeping `density = 0` (`cover.ts:89-91`) | `470 / 470` (`100.0%`) overridden to `density = 0.38` | `0%` bare bedrock/cliff spots forced to grass (Baldwin & Sims 1997) | `0.0000` | **NO** (grass forced onto bare granite & steep cliffs) |
| Late-ground loading-card handoff invariants (`main.ts:813-822`, `startup.ts:215`, `loading.ts:31-35`) | `0 / 4` (`abortIfStillMissing=false`, `splashPriorityDuringWait=false`, `standPoint=false`, `loadingClearTimeout=false`) | `4 / 4` safety & priority invariants met | `0.0000` | **NO** (90 s timeout drops player into empty void without chunk priority) |
| Live Jan 25 (`day=25`, `hour=11`, HUD `Snow 33.5 cm`) lower-frame snow-white pixel share (`frame-2`) | `0.1%` white (`98.0%` dark olive-brown, `meanRGB=[62,64,36]`) | `>= 60%` snow-bright ground under `33.5 cm` snow (`ref-2-midwinter-boreal-snow.jpg`) | `0.0012` | **NO** (bare dark ground beneath white winter grass) |

## Objectives

- [ ] Seat grass blade roots cleanly into the terrain mesh (`-0.01..0.0 m`, removing the `+0.03 m` hover in `src/render/grass/cover.ts:130`), bring near/far blade widths in `src/render/grass/grass.ts:108` back in line with FNA dimensions (with crisp anti-aliased sub-pixel clamping rather than `4×–12×` confetti ribbons), and remove the non-physical `2.6×` linear albedo overshoot in `grass.ts:135` so summer and autumn linear leaf reflectance stays strictly `<= 1.0` and within PROSPECT ranges.
- [ ] Scope the `viewedCover()` dry-landing fallback in `src/render/grass/cover.ts:89-91` so it only rescues dry landing clearings where Kenora-specific home lake/mask artefacts caused `0` density, preserving `defaultCover() = 0` on true bare granite outcrops (`bare === 1`) and steep cliffs (`slopeDeg > 40`).
- [ ] Replace the `0.35` snow ceiling in `snowPaint(depthCm)` (`src/render/continuousTerrain.ts:132-135`) with a physically grounded curve (patchy dusting at `1–5 cm`, smooth ramp to continuous `1.0` cover by `15–20 cm` per Wiscombe & Warren 1980 / Baker et al. 1991), copy `snow[i] = snow[src]` onto all LOD skirt vertices (`continuousTerrain.ts:220-226`), and invalidate/update the continuous terrain mesh when snow depth changes across seasons so terrain snow agrees with `grass.ts` `uSnowM` and the HUD snow readout.
- [ ] Harden the late-ground loading wait (`src/main.ts:813-822`, `src/render/startup.ts`, `src/ui/loading.ts`): keep `splashChunkBudget()` enabled during late-ground recovery, poll the canonical `standPoint(location.search, view.livingHere())` chunk, keep the loading card (with reload prompt) up instead of dropping into the void if the standing chunk never arrives after the timeout, and clear `loading.ts`'s `setTimeout` handle inside `finish()`.

## Verification
- Re-run `npx tsx refs/terrain/floor-grass-snow-landing-audit/audit.ts` on the implementation branch and confirm all `6 / 6` checks pass `>= 0.95` with `calibrationValid = true` and `0` console/page errors.
- Capture fresh before/after `1280×720` SwiftShader frames (`frame-0`..`frame-3`) matching `reference/ref-0-summer-boreal-floor.jpg`, `ref-2-midwinter-boreal-snow.jpg`, and `ref-3-autumn-boreal-floor.jpg`, and verify `npx tsc --noEmit` + `npm test` (`tests/grass.test.ts`, `tests/continuous-terrain.test.ts`, `tests/startup-warm.test.ts`, `tests/sim-home.test.ts`, `tests/rules.test.ts`, `tests/gait-gate.test.ts`).
- Write/update `notes/skills/floor-grass-snow-landing-audit.md` when completing the task.

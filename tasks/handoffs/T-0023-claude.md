# T-0023 water optics - handoff (claude)

Branch: **claude/water-optics** (worktree C:\dev\boreal-claude-water-optics, from main 17d5a7e), head **499d001** (13:34: water-leaving radiance x 1/n²; recordings refs/water/optics-after3/).
Board files (this handoff, events) live on claude/loop so they can reach main before the code. Preview port 5212 (claude range
5210-5229). Claimed 2026-10-21 12:22 PDT after grok's approve-plan (12:14:10).

**Status: open, NOT submitted.** Objectives 1 and 2 are built; the frame gate fails (mirror ratio 1.18 vs 0.5-0.9) and four
model inputs still need a regional source. No complete event.

## What I built (branch claude/water-optics)
- `src/render/water.ts`
  - **Fresnel mirror.** `createWaterMirror(renderer)`: three.js `examples/jsm/objects/Reflector.js` reused as is (we call its
    mirror-camera pass and sample its target; no copy). One pass per frame at 0.5 x the drawing buffer, plane y =
    `LEVEL.waterSurface`, only while `photoreal.tier.ibl` and the camera is above the water. The water material is hidden
    during the pass (no feedback loop). The shader replaces the IBL specular with `mix(diffuse, mirror, F)` + sun specular,
    Schlick `F = 0.02 + 0.98 (1 - cos)^5` (Water2.js); ripple gradient wobbles the mirror UV. Lakes at other levels and the
    tiers without IBL reflect the fog/horizon colour by the same Fresnel. Uniforms only: same program key, no new program.
  - **Humic body + shallows from absorption, not a picked colour.** `HUMIC` data: pure-water absorption (Pope & Fry 1997) +
    CDOM `a440 e^(-S(λ-440))` (Bricaud et al. 1981) -> `K = a/μd`; deep reflectance `R∞ = 0.33 bb/a` (Morel & Prieur 1977);
    shallow-water model `R = R∞(1 - e^(-2KH)) + Ab e^(-2KH)` (Maritorena, Morel & Gentili 1994) per channel in the shader.
    `metalness .1 -> 0`, colour 0x578d91 -> R∞ (linear 0.011, 0.007, 0.002).
  - `openWaterGeometry(terrain)`: the open-water sheet of a chunk is its terrain grid (subsampled to ~2 m, 800 tris on a near
    chunk) at the water level with `aDepth` per vertex; **null on dry chunks** (was one quad on every chunk).
  - **Exit factor (499d001):** `HUMIC.exit = 1/n²` (0.563) multiplies the body + bottom radiance in the shader: upwelling
    radiance spreads into a wider cone when it leaves the water (n² law; Lee et al. 2002: above-water Rrs ≈ 0.52 rrs). Before,
    the water body was lit like a Lambert surface of albedo R, ~1.8x too bright. One constant, no new uniform or program.
- `src/render/buildScene.ts`: the water quad -> `openWaterGeometry` sheet; `waterMirror.update(...)` before `post.render`.
- `tests/water-optics.test.ts` (4 tests): Fresnel 2 % / 100 % and 30-66 % at 15-45 m; K order blue > green > red, R∞ <= ~1 %,
  implied Secchi 1-4 m; shallow reflectance limits; sheet depth per vertex and null when dry.
- `refs/water/shore-audit/capture.mjs` takes an output dir: `node refs/water/shore-audit/capture.mjs <port> <dir>`.

## How to verify
1. At 499d001: `npx tsc --noEmit` exit 0; `npm test` 365 tests / 353 pass / 0 fail / 12 todo; water-optics.test.ts 5/5
   (new: exit factor 1/n² = 0.563 within Lee et al. 2002's 0.52-0.57). Earlier: `npx tsc --noEmit` (exit 0 at 93d6f2c); `npm test` at 93d6f2c: 364 tests / 351 pass / 1 fail / 12 todo - the fail is the known
   trace flake ("trace off: hooks are pass-through", tests/trace.test.ts: 5/5 pass in 3 of 3 solo re-runs). Earlier: 360/348/0/12 at e3b7426 (before the water
   test file); `npx tsx --test tests/water-optics.test.ts`: 4/4 pass at d4982c7.
2. `npx vite --host 127.0.0.1 --port 5212 --strictPort`, then `node refs/water/shore-audit/capture.mjs 5212 <dir>` and
   `node refs/water/shore-audit/measure.mjs <dir>`; mirror ratio = measure.json noon-0 `water_far.relLum / far_treeline.relLum`.

## Number table (game vs nature)
| Quantity | Game (branch) | Nature (source) | Resembles? |
|---|---|---|---|
| Reflectance head-on / at 15, 30, 45 m from a 3.3 m eye | Schlick 2 % / 31.2, 56.9, 69.0 % (computed; test asserts within 6 pts) | exact Fresnel n = 1.333: 2 % / 30.5, 54.1, 66.2 % (Hecht, *Optics*) | yes (within 3 pts; Schlick's known grazing error) |
| **Mirror ratio** (calibrated, rule 11: real lakes 0.66 / 0.73, game before 5.04; refs/water/shore-audit/mirror-ratio.json) | **1.016** mirror only (refs/water/optics-after), **1.176** with shallow colour (refs/water/optics-after2). Box check 13:30 (refs/water/optics-after2/box-diag.mjs + .txt, same statistic): with the water box over the treeline box's own x-range (300-900; the photo boxes overlap the same way) **0.805** mirror only, **0.991** with shallows; the strip x 900-1200 alone 3.4-3.5, and its crop (optics-after2/crop-right-strip.png) shows why: there the original water box covers the lit grassy far bank, not water. **499d001 (x 1/n² on exit, refs/water/optics-after3): 1.116 original box, 0.894 matched box** | 0.5-0.9 (real photos 0.66-0.73) | **no** on the gate box (1.116); 0.894 on the matched box passes by 0.006 only. Ruling on the box asked in comment event 13:35 (T-0023). The original box stays the gate unless a reviewer agrees the matched box is the calibrated rule (no box changes after the fact) |
| Deep-water reflectance R∞ (R, G, B) | 1.1 / 0.7 / 0.2 % | "negligible across the visible" in very brown lakes (Kutser, Paavel & Kauer, EGU2015-13460) | plausible, bound only |
| CDOM a440 / slope S | 5 m⁻¹ / 0.016 nm⁻¹ (= a380 13 m⁻¹, i.e. DOC ~13 mg/L at 0.98 L mg⁻¹ m⁻¹) | 10 Finnish lakes: a380 1.9-20 m⁻¹, S ~0.016 nm⁻¹, specific a380 0.98 L mg⁻¹ m⁻¹ (Kallio 1999, Proc. Estonian Acad. Sci. Biol. Ecol. 48(1): 75-83; read via its abstract, the kirj.ee PDF is a scanned image I could not decode here) -> a440 0.7-7.7 m⁻¹. Clear subarctic Lapland lakes: a440 0.4-1.4 m⁻¹ (Écoscience 2015, 18 lakes). WFD classes: colour > 30 mg Pt/l = humic ≈ aCDOM(400) 3.6 m⁻¹, > 90 mg Pt/l = humus-rich ≈ 11 m⁻¹ (arXiv 2101.02505); game a400 = 5 e^(0.016·40) = 9.5 m⁻¹ -> humic, near humus-rich | **yes, at the brown end** (upper third of Kallio's range) |
| Kd green (PAR proxy) / implied Secchi (Poole & Atkins: 1.7/Kd) | 1.15 m⁻¹ / 1.5 m | small Canadian Shield lakes: DOC 1.4-12.4 mg/L, Secchi tracks DOC (r = -0.91) (Pérez-Fuentetaja et al. 1999, Aquatic Ecology); Ontario Lake Partner Program: usual Secchi 4-6 m, up to ~10 m | **dark tail**: a brown-water lake, darker than the typical Shield lake. Kept on purpose: the reference asks for dark humic water, and clearer water would show more bottom (raising the ratio). Causal version: leftover 6 |
| Backscatter bb | 0.02 m⁻¹ | lake values 0.01-0.05 m⁻¹ (to cite) | **[verify]** |
| Bottom albedo Ab (R, G, B) | 0.16 / 0.13 / 0.09 | boreal littoral sand/stones with organic film (to cite) | **[verify]** |
| Bottom visible to | ~1 m (two-way green transmittance 10 % at 1 m, 1 % at 2 m) | bottom visible in < ~1 m shallows (t0023-noon.png; Secchi above) | yes (pending the [verify] rows) |
| Ripple roughness | 0.32 (unchanged) | Cox & Munk 1954: σ² = 0.003 + 0.00512 U -> GGX roughness ~0.36-0.40 at U = 1-2 m/s | yes |
| Mirror cost (Ultra/High, where it runs) | +0.56 M tris (1.21-1.31 M vs 0.65-0.75 M forced off), CPU draw +0.6-1 ms; GPU 7.9-8.0 vs 7.0 ms on main (Ultra, run 1), noisy | budget: 60 fps held on RTX 5060 laptop | GPU cost unresolved (see leads) |

## Frame answers
Recordings: before `refs/water/shore-audit/` (main); mirror only `refs/water/optics-after/`; mirror + shallow colour
`refs/water/optics-after2/` (noon-0..3, wade-0..5, wade-stop-0..1, evening-0..3, .webm). Reference: `refs/water/reference/
t0023-noon.png`, `t0023-dusk.png` (agy), real photos `refs/water/reference/real/`.
- **What do I see (optics-after2/noon-0):** behind the wolf on the grassy shore, the ~40 m water band now mirrors the far shore
  upside down: directly under the bank a dark band, then the far trunks as dark vertical bars with **bright white streaks of sky
  between them**, then the mirrored green crowns, darker than the real ones; the near edge is brown-olive (bottom through
  shallow water). Ripples wobble the image slightly. Wading (wade-5): calm, dark water mirrors the whole forest overhead; near
  the wolf, the brown-olive bottom shows under a faint reflection of the crowns. Evening: dark water mirroring the dark forest
  (before: a uniform bright blue band).
- **Natural? How I know:** the optics now match nature's mechanism (Fresnel split, dark humic body, bottom only in shallows):
  numerically, the Fresnel rows pass and the water band went from 5.0x to ~1.0-1.2x the treeline it mirrors. But the
  reference (t0023-noon.png) and the real photos mirror a **dense dark treeline**: the band under the shore is uniformly dark.
  In the game the reflected trunk zone is full of sky streaks, because the mirror camera looks up under the canopy through an
  open trunk zone. A real lake edge is closed to the ground (edge trees keep low live branches, shrub belt). That is forest
  structure, not water optics, and it is what holds the ratio at ~1.0 instead of ~0.7 (the shallow bottom adds +0.16).
- **optics-after3/noon-0 (499d001):** the same view; the shallow near edge is a darker tea-brown, the mirror unchanged.
- **95 % match:** no. Mirror ratio 1.176 (93d6f2c) -> 1.116 (499d001) vs target 0.5-0.9 on the gate box: **fail**; 0.894 on
  the matched box (pending a ruling). A streak-reflectance check (refs/water/optics-after/
  streaks.mjs) is **uncalibrated** (tone mapping, 4 % pixel share) and is not used to pass anything.
- **Numbers:** table above; four inputs are [verify].

## Leftovers / leads
1. **Forest edge: measured 13:25, a smaller cause than I thought.** refs/forest-edge/edge-gap.mjs (+ edge-gap.json, on
   claude/loop): share of sky-coloured pixels (luminance > 0.5 x sky q95 AND blue >= green) in the far shore's low band and in
   its mirror. Calibration: known mismatch (real sky between spruce spires, taiga photo) **0.814**; closed real edges direct
   **0.000 / 0.002**, open taiga low band 0.000; real mirrors **0.000 / 0.023 / 0.024**. Game (main) direct low band **0.043**,
   game mirror band (93d6f2c) **0.034**. So the edge leaks some sky (direct 0.043 vs <= 0.002 real), but the mirror band holds
   only ~1 point more sky than real mirrors: too little to explain the ratio alone. The first version without the blue test
   scored the sunlit autumn hill in the Algonquin photo 0.17 (false positive), hence the colour test. Not proposed as a task yet:
   a lake-edge task needs a sourced shrub-belt width and density first (Harper et al. 2015, J. Ecol. 103: 550-562: lake/wetland
   edges included, edge influence usually < 20 m, more regeneration and lower canopy cover at edges; the game has alder and
   willow rows in core/flora/plants.ts at kappa .0006 / .0005 per m2, no edge term).
7. **Where the excess sits:** the strip x 900-1200 of the water band (ratio 3.4-3.5 vs 0.8-1.0 over x 300-900). Next: look at
   what that strip mirrors (crop the frame; the far bank there is a light grassy bank, plus sky between trunks) and whether the
   shallow-bottom term (+0.19 on the matched box) is too bright: its inputs bb and Ab are the two rows still [verify].
2. **?bench tier lag (found, not mine to fix):** with labels printed, `BENCH tier-High applied=Ultra:ibl1 ...`, `tier-Minimum
   applied=Minimum:ibl1` (refs/water/optics-after2/bench-tier-printed.json). The applied tier lags the label by one sample
   and `ibl` reads 1 on Minimum although `LADDER` says 0. So ?bench cannot measure IBL-gated features (the mirror runs in
   every sample). Not traced; owner of core/quality or src/main.ts ?bench (grok perf).
3. Bottom is a uniform albedo: no stones/sand pattern as in the reference (could reuse core/rocks or the terrain colour).
4. Direct sun glint still uses MeshStandard F0 0.04 (water 0.02).
5. Double fog on the mirrored image (the mirror pass fogs the full path, the water fogs camera->water again): small at 40 m.

## Exact next step
1. (Done 12:49: full `npm test` at 93d6f2c = 351 pass, 1 known trace flake, 12 todo.)
2. (Done 13:35: a440/S and Secchi rows sourced, see table. Still [verify]: bb and bottom albedo Ab - search "littoral sediment
   reflectance boreal lake" / "bottom albedo organic sediment"; Hydrolight/Maritorena 1994 tables list sediment albedos.)
3. (Done 13:30: lead 1 measured - the edge is a minor cause; lead 7 added.)
4. (Done 13:34: lead 7. The crop shows the bright strip is far bank inside the water box, a box error. Found and fixed a
   physics gap on the way: the body/bottom radiance lacked the 1/n² exit factor -> 499d001, optics-after3: 1.116 / 0.894.
   Comment event 13:35 asks a reviewer to rule on the matched box.)
5. **Next:** (a) read the reviewers' answer to the 13:35 comment (`git log --all --name-only -- tasks/events | grep T-0023`).
   (b) Source bb and Ab. Leads found 13:38 (values not read yet): bb - Herlevi 2002, "A study of scattering, backscattering and
   a hyperspectral reflectance model for boreal waters", Geophysica 38: 113-132 (Hydroscat-6 in Finnish, Estonian, Swedish
   lakes; archive.geophysica.fi PDF returned 503 twice); Ab - Kutser et al. 2020 review of bottom-type reflectances (cited by
   the IOCCG benthic-reflectance proposal; the claim is that bottom types match across freshwater and sea). No PDF renderer
   here (no pdftoppm), so scanned PDFs (kirj.ee) cannot be read: prefer HTML or text PDFs. If nature's Ab is lower than 0.16/0.13/0.09, update HUMIC.bottom and re-record
   (`node refs/water/shore-audit/capture.mjs 5212 refs/water/optics-after4`, then measure.mjs + optics-after2/box-diag.mjs).
   (c) Submit only when the gate box (as ruled) gives 0.5-0.9 with margin and no [verify] row is left; then write the complete
   event and update notes/skills/visual-inspection-recording.md.

## Needs from another agent
- grok (perf / core/quality): lead 2, so the mirror's per-tier GPU cost can be measured.

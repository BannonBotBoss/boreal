# T-0023 water optics - handoff (claude)

Branch: **claude/water-optics** (worktree C:\dev\boreal-claude-water-optics, from main 17d5a7e), head **91b0675** (14:40: exact Fresnel; recordings refs/water/optics-after6/).
Board files (this handoff, events) live on claude/loop so they can reach main before the code. Preview port 5212 (claude range
5210-5229). Claimed 2026-10-21 12:22 PDT after grok's approve-plan (12:14:10).

**Status: open, NOT submitted (2026-10-21 14:40).** Objectives 1 and 2 are built. Box ruled by agy (13:42): the gate box is the
x-matched [300,262,900,285]. On it the mirror ratio is **0.819** (optics-after6, 91b0675); the calibrated real lakes are **0.66 and 0.73**.
The 0.5-0.9 band I used in earlier runs was my own, never in the task file or plan review: I withdraw it. Honest score: 0.819 is
12-24 % brighter than the real lakes (1 - |0.819 - 0.695| / 0.695 = 82 % match), so the frame gate fails. One input (bb) is
still [verify]. No complete event.

## Run 2026-10-21 17:20 PDT (claude/loop session; in progress)
- [x] Merged main 379bbb3 into claude/loop. Review first (rule 15): board built from all 118 event files on all branches.
      No complete lacks a non-author approve (T-0026 grok 15:24, T-0027 grok 13:31, T-0008). Proposed without approve-plan:
      T-0001 (mine, cannot), T-0007 (task file unchanged since 10-19 07:29; my 12:21 comment stands). Nothing to review.
- Split with the other claude session (claude/water, runs at :45): it owns rivers T-0029..T-0031; this session keeps T-0023.
- [x] 1c water depth along the ruled box (refs/water/optics-after7/box-depth.ts + .txt, claude/water-optics 95f1d41): the box
      sees water 41-63 m from a 3.3 m eye (cos in air 0.05-0.08), 0-1 m deep near the far bank; the enlarged crop
      (optics-after7/box-crop-after6.png) shows the box is all water (the far waterline sits at y ~258).
- [x] Found the main cause of the excess, and it breaks the gate's precondition (optics-after7/streak-share.mjs, same pixel class
      as the calibrated refs/forest-edge/edge-gap.mjs): **12.2 % of the treeline box is sky** between the far trunks (real closed
      edges 0.000-0.002) and **4.7-5.1 % of the ruled water box is mirrored sky** (real mirrors 0.000-0.024). Counterfactual:
      sky pixels -> non-sky mean in the water box only 0.594; in both boxes **1.72**. So 0.819 is not a valid reading: the
      metric assumes a closed treeline box, as in every calibration photo. Step 1a (no-bottom run) dropped: moot until then.
- [x] Repeat recording (refs/forest-edge/trunk-zone/default-0..2 on claude/loop, my vite 5212 = the 14:25 one left running by
      the 14:20 run, now reused and stopped at the end): ratio 0.819-0.843. **?trees=v2 does not close the edge**: treeline sky
      0.128, mirrored sky 0.109-0.112, ratio 1.12-1.15.
- [x] Proposed **T-0032** (forest trunk zone closed; 52 cr; event 17:33) and commented T-0023 (17:34): T-0023 waits on T-0032.
- Honest status: T-0023 open, claimed, not submitted. When T-0032 closes the edge, re-record and re-measure: if the water then
  reads ~1.7x the closed forest, the water itself is too bright (suspects: the shallow-bottom term over a 0-1 m deep far margin,
  the mirrored sunlit bank, the sun glint F0 .04 vs water .02), and that is T-0023 work.

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
  - **Slant path (db94d50, fe08591):** the bottom's light climbs to the eye along the refracted view ray, so the two-way
    attenuation 2KH becomes KH (1 + 1/cos θw) (Lee et al. 1999, Appl. Opt. 38:3831: D_u ∝ 1/cos θw; = 2KH looking straight
    down). cos θw from Snell with the world-space eye vector (`cameraPosition` - fragment). A first version with the
    view-space vector (viewMatrix x up . normalize(vViewPosition)) rendered the whole water black (exact 0) in wade-2..5 and
    wade-stop: 90 % zero pixels; cause not traced; the world-space version has 0 % (optics-after5). Exported `cosInWater`;
    `shallowReflectance(depth, cosAir = 1)`; test 6 (85 deg in air -> 48.4 deg in water; slant darker than straight down).
  - **Exact Fresnel (91b0675):** the mirror weight is the exact unpolarised Fresnel reflectance of n = 1.333 (Hecht), not
    Schlick (Water2.js), which runs ~3 points high at the grazing angles that matter here (56.9 vs 54.1 % at 30 m). Same in
    `waterFresnel` (JS) and the shader. Test 1 now checks 30.5 / 54.1 / 66.2 % within 0.5 pt at the table's 3 m eye (it used a
    3.3 m eye with a 6 pt tolerance, which hid the mismatch).
- `refs/water/shore-audit/capture.mjs` takes an output dir: `node refs/water/shore-audit/capture.mjs <port> <dir>`.

## How to verify
1. At 91b0675 (14:40): `npx tsc --noEmit` exit 0; `npm test`: see claude-loop.md run 14:20 entry; water-optics.test.ts 6/6. At 499d001: `npx tsc --noEmit` exit 0; `npm test` 365 tests / 353 pass / 0 fail / 12 todo; water-optics.test.ts 5/5
   (new: exit factor 1/n² = 0.563 within Lee et al. 2002's 0.52-0.57). Earlier: `npx tsc --noEmit` (exit 0 at 93d6f2c); `npm test` at 93d6f2c: 364 tests / 351 pass / 1 fail / 12 todo - the fail is the known
   trace flake ("trace off: hooks are pass-through", tests/trace.test.ts: 5/5 pass in 3 of 3 solo re-runs). Earlier: 360/348/0/12 at e3b7426 (before the water
   test file); `npx tsx --test tests/water-optics.test.ts`: 4/4 pass at d4982c7.
2. `npx vite --host 127.0.0.1 --port 5212 --strictPort`, then `node refs/water/shore-audit/capture.mjs 5212 <dir>` and
   `node refs/water/shore-audit/measure.mjs <dir>`; mirror ratio = measure.json noon-0 `water_far.relLum / far_treeline.relLum`.

## Number table (game vs nature)
| Quantity | Game (branch) | Nature (source) | Resembles? |
|---|---|---|---|
| Reflectance head-on / at 15, 30, 45 m from a 3 m eye | exact Fresnel since 91b0675: 2.04 % / 30.5, 54.15, 66.2 % (test 1, within 0.5 pt); was Schlick 2 % / 31.2, 56.9, 69.0 % | exact Fresnel n = 1.333: 2 % / 30.5, 54.1, 66.2 % (Hecht, *Optics*) | yes (same formula) |
| **Mirror ratio** (calibrated, rule 11: real lakes 0.66 / 0.73, game before 5.04; refs/water/shore-audit/mirror-ratio.json) | **1.016** mirror only (refs/water/optics-after), **1.176** with shallow colour (refs/water/optics-after2). Box check 13:30 (refs/water/optics-after2/box-diag.mjs + .txt, same statistic): with the water box over the treeline box's own x-range (300-900; the photo boxes overlap the same way) **0.805** mirror only, **0.991** with shallows; the strip x 900-1200 alone 3.4-3.5, and its crop (optics-after2/crop-right-strip.png) shows why: there the original water box covers the lit grassy far bank, not water. **499d001 (x 1/n² on exit, refs/water/optics-after3): 1.116 original box, 0.894 matched box.** Ruled box (agy 13:42) = matched box. Repeat at 499d001 (optics-after4): 0.889 (run-to-run ±0.005). Slant path fe08591 (optics-after5): **0.859**. Exact Fresnel 91b0675 (optics-after6): **0.819**. Diagnostic, bottom albedo set to the deep R∞ (frames not kept; reproduce with next step 1a): 0.766, so the shallows add ~0.09 and the rest is the mirror term | real photos 0.66-0.73 (the 0.5-0.9 band of earlier runs withdrawn: it was mine, never agreed) | **no**: 0.819 vs 0.66-0.73, 82 % match |
| Deep-water reflectance R∞ (R, G, B) | 1.1 / 0.7 / 0.2 % | "negligible across the visible" in very brown lakes (Kutser, Paavel & Kauer, EGU2015-13460) | plausible, bound only |
| CDOM a440 / slope S | 5 m⁻¹ / 0.016 nm⁻¹ (= a380 13 m⁻¹, i.e. DOC ~13 mg/L at 0.98 L mg⁻¹ m⁻¹) | 10 Finnish lakes: a380 1.9-20 m⁻¹, S ~0.016 nm⁻¹, specific a380 0.98 L mg⁻¹ m⁻¹ (Kallio 1999, Proc. Estonian Acad. Sci. Biol. Ecol. 48(1): 75-83; read via its abstract, the kirj.ee PDF is a scanned image I could not decode here) -> a440 0.7-7.7 m⁻¹. Clear subarctic Lapland lakes: a440 0.4-1.4 m⁻¹ (Écoscience 2015, 18 lakes). WFD classes: colour > 30 mg Pt/l = humic ≈ aCDOM(400) 3.6 m⁻¹, > 90 mg Pt/l = humus-rich ≈ 11 m⁻¹ (arXiv 2101.02505); game a400 = 5 e^(0.016·40) = 9.5 m⁻¹ -> humic, near humus-rich | **yes, at the brown end** (upper third of Kallio's range) |
| Kd green (PAR proxy) / implied Secchi (Poole & Atkins: 1.7/Kd) | 1.15 m⁻¹ / 1.5 m | small Canadian Shield lakes: DOC 1.4-12.4 mg/L, Secchi tracks DOC (r = -0.91) (Pérez-Fuentetaja et al. 1999, Aquatic Ecology); Ontario Lake Partner Program: usual Secchi 4-6 m, up to ~10 m | **dark tail**: a brown-water lake, darker than the typical Shield lake. Kept on purpose: the reference asks for dark humic water, and clearer water would show more bottom (raising the ratio). Causal version: leftover 6 |
| Backscatter bb | 0.02 m⁻¹ | lake values 0.01-0.05 m⁻¹ (to cite: Herlevi 2002 Geophysica 38:113 and Kutser et al. 2009 Boreal Env. Res. 14:305 both returned HTTP 503 on 2026-10-21 12:40 and 14:24) | **[verify]**. Weight on the gate is small: R∞ = 0.33 bb/a is 0.2-1.1 % (x 2.5 at bb 0.05), the shallow term is set by Ab |
| Bottom albedo Ab (R, G, B) | 0.16 / 0.13 / 0.09 | wet sand, 4 samples: R 0.092-0.309, G 0.087-0.265, B 0.070-0.210; gravel 0.124 / 0.112 / 0.060 (Vahtmäe et al. 2024, PANGAEA.971518, π·Rrs at 610/550/466 nm; refs/water/bottom-albedo/ on claude/loop). Organic/vegetated bottoms 0.02-0.06 | **yes** for the sand-and-stones bottom the reference shows (between sand sample 1 and the sand mean). Baltic coastal data, not a lake: see SOURCES.md |
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
- **optics-after6/noon-0 (91b0675):** same view; the mirror band slightly darker; wade-2..5 normal (0 % black pixels).
- **95 % match (14:40):** no: 0.819 on the ruled box vs real 0.66-0.73 = 82 %. Older note: no. Mirror ratio 1.176 (93d6f2c) -> 1.116 (499d001) vs target 0.5-0.9 on the gate box: **fail**; 0.894 on
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
(Runs before 14:20 did steps 1-4 of the older list: full tests, a440/S/Secchi sourced, edge measured, box diagnostic + 1/n².)
Run 14:20: box ruled (agy), Ab sourced (PANGAEA), slant path + exact Fresnel built, ratio 0.894 -> 0.819. Next, in order:
1. **Find the rest of the mirror term's excess** (0.766 with no bottom at fe08591; with exact Fresnel it should be ~0.73):
   (a) re-run the no-bottom diagnostic at 91b0675 (sed HUMIC.bottom to [.011, .007, .002], capture to a dir outside the repo,
   box-diag, git checkout the file - note: checkout rewrites CRLF, normalise before scripted edits);
   (b) the mirror image itself: what the reflected far shore holds vs the real mirror (sky streaks under the canopy: edge-gap
   metric 0.034 vs real 0-0.024; mirrored crowns brightness). A closed lake edge is forest structure: needs a sourced edge
   shrub/branch density (Harper et al. 2015) and its own task, not T-0023.
   (c) the shallow term: the far shore's slope sets how much bottom shows in the box; check depth along the box (aDepth).
2. bb: Herlevi 2002 / Kutser et al. 2009 when geophysica.fi / borenv.net answer (both 503 on 2026-10-21).
3. Submit only when the ruled box gives >= 95 % match to the real lakes (0.66-0.76 for 95 % of 0.695..0.73), with recordings,
   and no [verify] row; then the complete event and notes/skills/visual-inspection-recording.md.

## Needs from another agent
- grok (perf / core/quality): lead 2, so the mirror's per-tier GPU cost can be measured.

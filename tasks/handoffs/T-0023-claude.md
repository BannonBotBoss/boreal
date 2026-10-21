# T-0023 water optics - handoff (claude)

Branch: **claude/water-optics** (worktree C:\dev\boreal-claude-water-optics, from main 17d5a7e), head **93d6f2c**.
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
- `src/render/buildScene.ts`: the water quad -> `openWaterGeometry` sheet; `waterMirror.update(...)` before `post.render`.
- `tests/water-optics.test.ts` (4 tests): Fresnel 2 % / 100 % and 30-66 % at 15-45 m; K order blue > green > red, R∞ <= ~1 %,
  implied Secchi 1-4 m; shallow reflectance limits; sheet depth per vertex and null when dry.
- `refs/water/shore-audit/capture.mjs` takes an output dir: `node refs/water/shore-audit/capture.mjs <port> <dir>`.

## How to verify
1. `npx tsc --noEmit` (exit 0 at 93d6f2c); `npm test` at 93d6f2c: 364 tests / 351 pass / 1 fail / 12 todo - the fail is the known
   trace flake ("trace off: hooks are pass-through", tests/trace.test.ts: 5/5 pass in 3 of 3 solo re-runs). Earlier: 360/348/0/12 at e3b7426 (before the water
   test file); `npx tsx --test tests/water-optics.test.ts`: 4/4 pass at d4982c7.
2. `npx vite --host 127.0.0.1 --port 5212 --strictPort`, then `node refs/water/shore-audit/capture.mjs 5212 <dir>` and
   `node refs/water/shore-audit/measure.mjs <dir>`; mirror ratio = measure.json noon-0 `water_far.relLum / far_treeline.relLum`.

## Number table (game vs nature)
| Quantity | Game (branch) | Nature (source) | Resembles? |
|---|---|---|---|
| Reflectance head-on / at 15, 30, 45 m from a 3.3 m eye | Schlick 2 % / 31.2, 56.9, 69.0 % (computed; test asserts within 6 pts) | exact Fresnel n = 1.333: 2 % / 30.5, 54.1, 66.2 % (Hecht, *Optics*) | yes (within 3 pts; Schlick's known grazing error) |
| **Mirror ratio** (calibrated, rule 11: real lakes 0.66 / 0.73, game before 5.04; refs/water/shore-audit/mirror-ratio.json) | **1.016** mirror only (refs/water/optics-after), **1.176** with shallow colour (refs/water/optics-after2) | 0.5-0.9 (real photos 0.66-0.73) | **no** - see cause below |
| Deep-water reflectance R∞ (R, G, B) | 1.1 / 0.7 / 0.2 % | "negligible across the visible" in very brown lakes (Kutser, Paavel & Kauer, EGU2015-13460) | plausible, bound only |
| CDOM a440 / slope S | 5 m⁻¹ / 0.016 nm⁻¹ | S 0.0158-0.030 nm⁻¹ (Lake Balaton, non-boreal); boreal Finnish a440 survey **not found yet** | **[verify]** |
| Kd green (PAR proxy) / implied Secchi (Poole & Atkins: 1.7/Kd) | 1.15 m⁻¹ / 1.5 m | boreal lakes Secchi ~1-4 m (task table; regional survey still to cite) | in range, **[verify] source** |
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
- **95 % match:** no. Mirror ratio 1.176 vs target 0.5-0.9: **fail**. A streak-reflectance check (refs/water/optics-after/
  streaks.mjs) is **uncalibrated** (tone mapping, 4 % pixel share) and is not used to pass anything.
- **Numbers:** table above; four inputs are [verify].

## Leftovers / leads
1. **Forest edge (cause of the failing ratio):** the far shore has an open trunk zone; sky shows between trunks in the mirror.
   Next owner: inspect lake-edge vegetation (edge-tree crown length, riparian shrub belt - alder, sweet gale, leatherleaf)
   with sources before proposing a task; T-0025 covers in-water plants only.
2. **?bench tier lag (found, not mine to fix):** with labels printed, `BENCH tier-High applied=Ultra:ibl1 ...`, `tier-Minimum
   applied=Minimum:ibl1` (refs/water/optics-after2/bench-tier-printed.json). The applied tier lags the label by one sample
   and `ibl` reads 1 on Minimum although `LADDER` says 0. So ?bench cannot measure IBL-gated features (the mirror runs in
   every sample). Not traced; owner of core/quality or src/main.ts ?bench (grok perf).
3. Bottom is a uniform albedo: no stones/sand pattern as in the reference (could reuse core/rocks or the terrain colour).
4. Direct sun glint still uses MeshStandard F0 0.04 (water 0.02).
5. Double fog on the mirrored image (the mirror pass fogs the full path, the water fogs camera->water again): small at 40 m.

## Exact next step
1. (Done 12:49: full `npm test` at 93d6f2c = 351 pass, 1 known trace flake, 12 todo.)
2. Source the four [verify] rows (Finnish/Ontario lake CDOM a440 and Secchi surveys; lake bb; littoral bottom albedo) and
   adjust `HUMIC` if needed.
3. Inspect the lake edge (lead 1). The mirror ratio can only reach 0.5-0.9 once the far shore is a closed wall. Either a
   forest-edge task lands first, or this task is re-scoped with Matthew/the reviewer to "optics correct, edge pending" (a comment
   event with the evidence above), never rounded to a pass.

## Needs from another agent
- grok (perf / core/quality): lead 2, so the mirror's per-tier GPU cost can be measured.

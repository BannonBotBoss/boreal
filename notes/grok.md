# Grok Bot notes

## 2026-10-18 16:55 PT - Grok Bot (shared perf): the intermittent "2 fps on every tier" headless runs are the GPU vsync thread
- **Symptom:** a headless smoke/bench page loads in 140-190 s (not ~30 s), then draws ~2 fps on every tier, Minimum included. Main thread 98 % idle, GPU 0.2-9 ms/frame (timer query), no shader link churn, VRAM 5 of 8 GB. Same build alternates good/bad; the served tree and worktrees both hit it.
- **Cause:** a 3 s browser trace in the bad mode shows `GpuVSyncThread` busy 2999 of 3000 ms (`WinVSyncProvider`): Edge's GPU process waits on Windows' vblank and frames are paced at ~2 Hz. Display state on omen (two monitors, one reported to the session), not app code.
- **Check:** with `--disable-gpu-vsync --disable-frame-rate-limit`, the same build right after two bad runs loaded in 28 s and rendered every tier (smoke PASS).
- **tools/smoke-tiers.mjs** (branch grok/smoke-vsync) now runs with GPU vsync off by default (`SMOKE_VSYNC=1` keeps it), prints link counts per tier, and on a dead tier a trace summary. Vsync-ON benches on omen can still hit the bad mode: check the load time (>100 s = bad) and rerun.
# Grok Bot notes

## Trees M2 (branch grok/trees-v2, 2026-10-18) — procedural black spruce, realism + live swap behind ?trees=v2

Branch only; Matthew merges. `?trees=v2` is OFF by default.

- **Realism** (core/flora/trees/forms.ts `irregular`, render/trees/weberPenn.ts): whorl gaps (14 %), missed slots (30 %), broken
  limbs (12 %, half dead), limb-length jitter, clumped L2 laterals, sparse dead lower limbs, dense club top, 2-6 deg lean with
  sweep. Seeded (no Math.random). Test: tests/trees.test.ts "M2 irregular whorls".
- **Colour**: lifted toward the photos' mid green (photo foliage medians ~ (77-86, 89-121, 50-73)): needle #8eb054 / shade
  #5c7442, card AO floor raised (gain 1.5 x (.7+.3 radial)(.82+.18 y)), crown palette greener, crown uTint .46, impostor tint
  (.39,.42,.8). Viewer medians near/mid/crown/impostor: (43,59,38) (47,64,39) (46,60,33) (45,61,39) — all LODs matched.
- **Near budget**: NEAR_BUDGET 15k tris, laterals are needle cards; age 40/90/140 near 6.6k/13.7k/15k, mid 1.2k/2.5k/3.0k.
  Game LODs: near < 28 m x RENDER.lod, mid to 55 x lod + 5, crown beyond.
- **Far crown**: <= 38 tris, up to 7 uneven drooping 4-sided skirts with 1-2 gaps, lean + sweep, clumped club (double pyramid +
  side knob); per-instance palette by low-freq noise, fake vertical AO, uniforms only.
- **Live swap**: render/trees/game.ts draws v2 black spruce (chunk trees + far filler) in 3 shared BatchedMeshes; hook in
  render/trees.ts (treeGeometry returns an empty group for v2 species), fartrees.ts places v2 crowns. Variants (4 age classes x 4)
  are built by sliced core/interest jobs `trees2:build:*`; `borealTreesV2.info.slow` logs any step > 4 ms with its BUILD_PHASE.
- **Dev**: `?tree=1` route in src/world/globe/entry.ts opens the viewer (`&view=lod|one`, `&steps=1` step timings, `&itint=`).
- Canvas 2D defers rasterising strokes even with willReadFrequently: the atlas flushes (1x1 getImageData) in each step.
- Leaf cards and tubes fill preallocated typed arrays (no number[] growth / per-vertex clones): the 15-24 ms in-game build
  steps were GC pauses; output is pixel-identical. Omen in game (?trees=v2, ?at=-10,-28): trees2 max step 4.5 ms (one
  addGeometry) / 2.9 ms, far filler 2.5-4.5 ms; box viewer all 16 variants <= 2.8 ms per step.
- Smoke (tools/smoke-tiers.mjs from grok/smoke-vsync 6cb6037, GPU vsync off), 2026-10-18 ~22:30 PT, on this branch:
  ?trees=v2 PASS x2 (Ultra 137 fps, 245-250 draws), default PASS x2 (Ultra 137-138 fps, 242-248 draws). No errors; v2 links 82 programs at load vs 74 (its 3 materials + depth variants), none per tier.
  v2 could be default-on once Matthew is happy with the look; it is still opt-in.

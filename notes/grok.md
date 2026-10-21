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
# Grok Bot notes

## Surface bands (T-0004, render/bands.ts): contract for material owners
- Opt out: `material.userData.noBands = true` (before the material's first compile). Opt in: send the material through `applySurfaceBands(material)` from render/bands (idempotent). Mixed materials can set `userData.bandsMask = '<GLSL float, 1 = band>'`.

## T-0006 solid contact (branch grok/T-0006-solid-contact)
- T-0005 wiring: core/logContact.ts + runtime-detected geometry.logSeat at buildScene's one call site (source
  chunk-build:log-seat when seated); no merge of T-0005 into T-0006; either merge order works.

## Shared animal pipeline + clover (branch grok/rabbit-clover, 2026-10-21)
- core/agent/pipeline.ts: species-agnostic senses (sight/hearing + core/senses scentLevel) -> levels (energy, stamina,
  relaxation with habituation) -> goal choice (utilities) -> action/motion -> CONTACTS 'feed' edges. Every number is in a
  species record (core/agent/species.ts); HARE_AGENT is the first. Actions 'held'/'tame' reserved for the hunting task.
- core/clover.ts: clearingAt (gap mask used by population spruce keep, fartrees dry(), site closure), clover patches
  (10 000 units/m^2, regrow full in 15 min of full sun x site light), graze/regrow transactions + why ('grazed'/'regrew').
- Migration (not done): deer = a DEER_AGENT record (fear wolf/person, diet forage/plant via a FoodSource over chunk
  entities) + host mapping actions onto animalBehavior motion/gait; wolf autonomy = a record whose 'fear' is empty and
  whose diet includes 'hare' (prey as FoodSource / chase action to add); people = record with no diet. Movement stays host-side
  for rigged animals (pipeline gives heading + speed + pose).
- ?hare=debug: labels per hare (action, why, E/S/R, hunger, threat vs notice, clover units) and per nearby patch.

## Clover and hare numbers, nature-checked (grok/rabbit-clover, 2026-10-21 11:00 PT)
Matthew: "how does a clover patch run out in nature?" and "do my numbers resemble nature?". Every rate below is a sourced
figure; nothing was tuned to look good. All biology runs in world (real) seconds like the other growth fields; only the
time-of-day dial is 12x (REAL_SECONDS_PER_GAME_HOUR = 300), so one game day of sun (2 real h) gives 2 h of growth.

| value | game number | real-world figure + source | resembles nature? |
| --- | --- | --- | --- |
| full clover patch (edible leaf) | 10 000 units/m^2 = 150 g DM/m^2 (1 unit = 15 mg DM) | 'Kopu' white clover 1.6 t DM/ha = 160 g/m^2 standing in spring (Olykan et al. 2021, J. NZ Grasslands 83, doi:10.33584/jnzg.2021.83.3494); leaf = lamina 15-20 mg + petiole 6-11 mg (J. NZ Grasslands 83, doi:10.33584/jnzg.2021.83.3498) | yes (Matthew's density kept; unit = about half a leaf) |
| residual (ungrazable) | stolon 50 g DM/m^2, never eaten; regrowth needs it | above-ground stolon 50-55 g/m^2 (Lincoln College stocking-rate study, hdl:10182/3015); "the stolon stays close to the ground so is rarely grazed" (DairyNZ, white clover) | yes (new) |
| regrowth rate | 6 g DM/m^2/day at full sun, >= 20 C | white clover 10 (winter) to 70 (summer) kg DM/ha/day, irrigated swards (Aust. J. Exp. Agric. 45:1577, 2005); Kopu peak 65 kg/ha/d (Olykan 2021) | yes |
| bare -> full | 25 days of summer (real time) | recovery 21-28 days after grazing/clipping (Miller et al. 1951, via UC SAREP white clover page) | yes; Matthew's 15 min FAILED (~2 400x too fast) and was replaced |
| night | 0 | net growth comes from photosynthesis (daylight) | yes |
| light | x site light (0.55-1 where clover grows) | white clover is shade-intolerant; low PAR lowers shoot DM (J. Inst. Agric. Anim. Sci. 27, doi:10.3126/jiaas.v27i0.703) | yes (linear is a simplification) |
| temperature / season | 0 at <= 5 C, linear to 1 at 20 C (climate() normals) | development base < 4 C, optimum ~27 C (Grass Forage Sci. 2006, doi:10.1111/j.1365-2494.2006.00553.x); clover needs ~10 C soil (Teagasc tech note); optimum ~5 C above ryegrass (DairyNZ) | yes; winter (Jan noon -13 C) and frost stop growth; drought not modelled |
| hare daily intake | energy 100 = 167 g DM = 11 133 units | snowshoe hares ate 167 +- 47 g DM/day in summer, 103 in winter (captive, Seeley Lake MT, UMT thesis); 6.4 % of body mass ad lib (Holter et al. 1974, Can. J. Zool., doi:10.1139/z74-201) | yes |
| energy per unit | 111 units = +1 energy | follows from the line above | yes; Matthew's 100 is within 10 % |
| energy drain | 100 per real day (1/864 per s) | the day's food is spent over a day | yes; Matthew's 1/8 per s FAILED (a day's food in 13 min) and was replaced |
| flight cost | x8 the daily-average rate | maximal aerobic rate ~10x resting in mammals (review, J. Exp. Biol. 160:209, 1991); a 2-3 s sprint is largely anaerobic, above that | flagged: plausible, no hare figure; effect tiny (8 s of flight = 0.07 energy) |
| cropping (bite) rate | 4.1 units per 3 s = 20.5 mg DM/s while in 'feed' | 167 g/day over 8.7 h/day of foraging x 26 % of it actually cropping (Belovsky 1984, Theor. Popul. Biol., doi:10.1016/0040-5809(84)90009-1); herbs max 2 g/min = 34 mg/s (same, Table I) | yes; Matthew's 100 units per 3 s FAILED (500 mg/s, a day's food in 5.5 min) and was replaced |
| bout ~3 s, head up ~1 s | kept (Matthew) | Belovsky: cropping is 26 % of active time; the rest is moving, chewing, standing | plausible, not checked against a bout-length source |

### How a patch runs out (the answer)
In nature a patch runs out when the animals cropping it eat faster than its stolons regrow leaf. One hare crops at
1.37 units/s; a 1 m patch regrows 0.025 units/s at noon in August (0.015 averaged over the day): ~55x slower.
- one hare, cropping nonstop: grazes a 1 m patch (31 416 units, 471 g) out in 6.5 h; a 0.5 m patch in 1.6 h; 1.4 m in 12.8 h.
- one hare at nature's time budget (2.26 h of cropping a day) on that one patch: 3.2 days (0.7 d for 0.5 m, 7.1 d for 1.4 m).
- recovery from grazed out: 25 days of summer sun (real time), any patch size; none in winter.
- in a 10 min play session one hare crops ~820 units (2.6 % of a 1 m patch): thinning is NOT visible in a session.
  Visible depletion needs many grazers (later deer through the same feed contact: deer eat ~10x a hare [estimate, verify]) or hours of play.
- Caveat: clover tiles are dropped beyond 2x the clover radius and rebuilt full when you return; state is not saved, so a
  grazed patch only stays grazed while you stay near it. Persisting it (closed form over world seconds + grazed deltas) is
  T-0015 / the T-0009 "closed form" criterion, not done.

# Handoff: T-0005 fallen logs, grounding and bark (grok-globe, 2026-10-19 06:49 PT)
Requested by Matthew (2026-10-19 06:37 PT, screenshot of a level log floating off a slope). Plan approved by grok (664d2a8).
Branch `grok-globe/log-grounding-bark`, worktree `C:\dev\boreal-grok-globe`, off main 7d71892. Matthew merges.
Matthew's clarification (06:48 PT): logs must sink partway into the ground (partial bury, 20-35 % of the thickness, seeded).
He also mentioned contact triggering a "transaction"; no contact-triggered animation or game system is built here.

## Seating physics (Matthew, 07:17 PT; replaces the 20-35 % sink)
Gravity pulls the fallen trunk; it tips and keeps adjusting until the trunk's force equals the earth's. Transaction: trunk
density x vs earth density y; the earth yields until both match. Final pose: flat against the earth (tilted with the slope),
pushed in about **one third of the trunk's width**. Implemented as buoyant equilibrium in yielding ground (`src/core/settle.ts`,
pure): immersed share of the cross-section = x / y. Reused, nothing new invented for the numbers: x = core/materials
`COMPOSITIONS.log.body` (512 kg/m3, the composition render/mass weighs logs with); y = core/ground `MINERAL.bulk` 1200-1500
(seeded per log) or `PEAT_BULK`, plus pore water (1 - bulk / quartz 2650) x the site wetness from core/stages/soils `soilAt`;
the earth over bedrock yields only to the bedrock (soilAt depth). Lake/river cells: the bed, saturated glaciolacustrine clay.
Measured over 17 x 17 chunks: clay median 0.34 of the width, till 0.36, lake beds ~0.32, peat 0.49, bedrock 0.02-0.15.
Considered and not used: Bekker pressure-sinkage (core/ground `BEKKER.wetLoam32`, the repo's foot model) gives ~3 cm under a
log (static load ~2.3 kN/m), far from Matthew's third; it stays the footprint model.

## T-0006 contract (grok/T-0006-solid-contact; merge-independent)
- `seatLog(group, entity)` returns `{ at, normal, settle }`; `logSeat(entity)` gives the same without three.js. `at` = the
  world point on the earth under the middle of the log, `normal` = the ground normal there (from the along and cross samples),
  `settle` = trunk and earth densities, soil kind and depth (for T-0006's why).
- T-0006 owns the single `CONTACTS.begin({ a: entity.key, b: 'ground', at, normal, kind: 'solid-solid', source: 'log-seat' })`
  at chunk build; this branch adds no contact bus and no second seating path, and T-0006 never moves a log.
- Either order merges cleanly: this branch does not touch `render/buildScene.ts`. If T-0006 lands first with its temporary
  centre sample, the follow-up is one line at that call site: `const { at, normal } = logSeat(entity)`.

## Merge order (please keep)
1. `perf6/near-shadows` (4c8d933): `LOG_MATERIAL` and near-cascade-only shadows for logs and rocks.
2. `grok/surface-bands`: global band multiply; the log material opts out with `userData.noBands = true`.
3. This branch. It merges 4c8d933 in (a merge commit, no edits to it), so after step 1 it adds only its own commits, and
   `render/photoreal.ts` is not touched. It does not contain surface-bands; it only sets the opt-out flag that branch reads.

## Pieces (one commit each)
- [x] propose + claim events, this handoff, notes/grok-globe.md (before any code)
- [x] merge perf6/near-shadows 4c8d933 (c65907e, no conflicts)
- [x] `tests/log-seat.test.ts` (399e556; failed on main + near-shadows: -5:-5:7 floating, bury -0.14/-0.03/-0.03; -5:3:23 pitch 0.00 vs ground 4.95 deg)
- [x] `seatLog` + `core/settle.ts` (95211cc)
- [x] bark hook on `LOG_MATERIAL` + `bark` attribute, 12/8/6 sides, smooth normals; `noBands`; `uBark` 0 on Low and cheaper;
      fade kept (4c7e4a9, tests/log-bark.test.ts)
- [x] budget numbers, smoke-tiers, captures (below)
- [ ] not done: the 300 m in-page descent capture (checked instead: `LOG_MATERIAL.userData.patchFade` is true in the page,
      i.e. render/fade's dither edit compiled into the log program); the noBands check ran in node against surface-bands
      f59ad1d (`wantsBands(LOG_MATERIAL)` false, hook and key untouched; control PROP_MATERIAL true), not as a merged capture.

## Budget (omen, RTX 5060 laptop, headless Edge; main = 7d71892)
| | target | measured |
|---|---|---|
| programs | <= +1 per tier | **+1 material program key; it shows as +2 links** at load (76 vs 74) and per tier (Medium 30+1 vs 29, Low 53 vs 51, Very low 30 vs 28, Minimum 42 vs 40). Seat-only (95211cc) = main exactly (74/18*/51/28/40), so the +2 is the bark hook. Most likely the game compiles every material for both post routes (photoreal: "Both post routes are compiled"), so one new key = 2 programs. Over the plan's <= +1 by one link per tier: **accepted by Matthew (via Grok Bot, 2026-10-19 ~10:57 PT); smooth bark kept exactly as built.** (The zero-program alternative, the same hook on PROP_MATERIAL with flat shading, is not pursued.) |
| draw calls | unchanged | unchanged by construction (logs already have their own BatchedMesh per chunk since 4c8d933; the hook adds no mesh). Smoke draws/frame are within run-to-run noise (Ultra 233 vs 219, Minimum 77 vs 76) |
| chunk build | <= +0.05 ms/log | `logSeat` 0.020 ms/log (node, 1000 seeded logs, 11 heightAt + 1 soilAt, memoised across the 3 LODs) |
| smoke | no new errors, no fps loss | official tools/smoke-tiers.mjs at 4c7e4a9: **PASS**, 60-61 fps every tier, no page errors. Same-mode comparison (smoke copy with `--disable-gpu-vsync`, measurement only): main 70/73/67/83/19/132 fps, branch 70/58/48/82/84/142 (Ultra..Minimum); single runs, noisy both ways (main dipped to 19 at Very low). The official smoke on main and on 95211cc hit omen's 2 fps vsync mode (GpuVSyncThread), on main too |

## Captures (13:00, Ultra unless noted; log 1:0:23 at 57.55, 37 on a ~10 deg slope)
Box `/workspace/`: `logs-before-close.jpg` (3.4 m) and `logs-before-medium.jpg` (25 m) from main 7d71892: level, faceted
brown box floating off the slope. `logs-after-close.jpg`, `logs-after-medium.jpg` from 4c7e4a9: tilted with the slope,
pressed in, bark plates and furrows. `logs-after-minimum-close.jpg`: Minimum tier, bark off (plain smooth log). All < 120 KB.

## How the bark data survives the batch (plan review nit 2)
Log parts are `userData.shared` meshes on `LOG_MATERIAL`, so `render/batch.ts` `flatten` uses `placed()`, which clones every
attribute other than position/normal/tangent unchanged. The body and the end disc of every LOD both carry `color` and `bark`,
so `mergeGeometries` and the BatchedMesh see one attribute set.

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build` in the worktree; `node tools/smoke-tiers.mjs http://127.0.0.1:<port>` against
the worktree's own dev server on a separate port.

## Log
- 06:49 claimed; handoff and notes first.
- 07:15 before captures (main 7d71892, log 1:0:23 at 57.55, 37 on a 10 deg slope, 13:00, Ultra): level log floating off the slope.
- 07:35 seating on the density model; logSeat bench 0.020 ms per log (1000 logs, node); tests 5/5.
- 08:15 bark committed (4c7e4a9), captures and budget done; worktree dev servers (:5195 branch, :5196 main) stopped, temporary
  main worktree C:\dev\boreal-t5-base removed (git could not delete its metadata folder in the served .git: permission denied, OneDrive lock; not listed by git worktree list; not pruned).
- 11:05 Matthew accepted the +2 programs (target was <= +1); no code change.
- Next (reviewer / Matthew): T-0006 swaps its centre sample for `logSeat(entity)` if it lands first; complete event after review.
---
id: T-0032
title: The forest is closed below the canopy - a lake's far shore reads as a dark wall to the ground, not a picket fence of poles with sky behind (edge regeneration, low live branches, drawn stems to the stand model)
author: claude
scratch: false
research: true
skill: visual-inspection-recording
tags: [flora, trees, render, water]
credits: 52
---
# T-0032 The forest is closed below the canopy

**Status: proposed by claude (2026-10-21 17:33 PT, forest-edge inspection from T-0023). Open claim: no owner.** Needs another
agent's `approve-plan` before a claim.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Not from scratch: reuses core/flora (stands, plants, site
thomas), render/flora/fartrees and render/trees (default and v2). Matthew can change it.

## What I saw (recorded 2026-10-21 17:30, my vite on 5212 at claude/water-optics 91b0675, hour 12)
Recording: `refs/forest-edge/trunk-zone/` (capture.mjs: the T-0023 lake view `?at=30,0,1.571&hour=12`, 3 stills with the
default trees `default-0..2.png` and 3 with `&trees=v2` `v2-0..2.png`; observations.json: 0 page errors). Earlier frames of
the same view: `refs/water/optics-after6/noon-0..3.png` (claude/water-optics), and main's `refs/water/shore-audit/noon-0.png`.
- **default-0:** behind the grey wolf, a meadow, then a ~40 m lake. The far shore is a low grassy bank and above it a row of
  bare grey poles (aspen, birch) and dark green cones (spruce) whose crowns start high; **between the poles and under the
  crowns, white sky shows all along the horizon** from the bank up to ~1/3 of the tree height. In the water under it, the
  mirror image repeats the poles and the gaps: dark bars with **bright white vertical streaks** of mirrored sky.
- **v2-0 (`&trees=v2`):** the same view with the v2 black spruce: narrower dark spires, more sky between them; the mirrored
  streaks are wider and brighter.
- Crop: `refs/water/optics-after7/box-crop-after6.png` (claude/water-optics): the treeline box and the water box enlarged.

## Natural? How I know
No. A real lake's far shore is a closed wall of foliage down to the waterline: the edge trees keep live branches low (black
spruce: "lower branches often touch the ground and root", Maine Forest Service, *Forest Trees of Maine*, black spruce;
layering), and edges carry more regeneration than the interior (Harper et al. 2015, J. Ecol. 103: 550-562, meta-analysis of
boreal edges incl. lake/wetland edges in Ontario, Quebec, Alberta, Sweden, Finland). The real lake photos used to calibrate
T-0023 (`refs/water/reference/real/`, SOURCES.json) and the generated references `refs/water/reference/t0023-noon.png` show it.
Measured, not eyeballed (rule 11): **sky share** of the trunk-zone band, `refs/forest-edge/edge-gap.mjs` (pixels with blue >=
green AND luminance > half the sky's q95). Calibration: known mismatch (real sky between spruce spires, taiga photo) **0.814**;
known matches: closed real lake edges **0.000 / 0.002**, open taiga low band 0.000, real mirrors **0.000 / 0.023 / 0.024**.
Same class in `refs/forest-edge/trunk-zone/streak-share.mjs` on the T-0023 boxes; results in `results.jsonl`.

## Number table
| Quantity | Game | Nature (source) | Resembles? |
|---|---|---|---|
| Sky share, far-shore trunk zone (box [300,150,900,230] of the lake view) | **0.121-0.122** default (3 frames), 0.122-0.123 (optics-after6, 4 frames); **0.128-0.129** trees v2 | closed real lake edges 0.000-0.002; mismatch 0.814 (edge-gap.mjs calibration) | **no** (60x the top of real) |
| Sky share in the mirror of that shore (water box [300,262,900,285]) | **0.048-0.052** default; **0.109-0.112** v2 | real mirrors 0.000-0.024 | **no** |
| Share of T-0023's mirror ratio due to mirrored sky | 0.819 -> 0.594 with the streak pixels set to the box's non-sky mean | real photos have ~no streaks | blocks T-0023 (below) |
| Drawn stems/ha near the viewer | tree entities ~60-290/ha (core/flora/stands.ts header); look-only filler only between `55·lod+5` (60 m) and `max(inner, INTEREST.mid)` (100 m) (render/flora/fartrees.ts:76) | 650-900/ha old growth (core/stand standAt), fire-origin black spruce 1300-2150/ha at 80-120 yr (Rossi et al. 2013, Silva Fennica 47(4), doi:10.14214/sf.973), jack pine 1164-1789/ha at 47-53 yr (Silva Fennica 2004, doi:10.14214/sf.128) | **no** inside 60 m; beyond ~100-170 m nothing (next row) |
| Where the drawn forest ends (lead for objective 1, from code, 17:40) | chunks (terrain, tree entities) are instantiated only within `INTEREST.mid` = 100 m (core/interest.ts:12 "beyond this nothing is instantiated"; render/buildScene.ts:145-154, whole 40 m chunks: up to ~170 m at the corners); the fog that hides the streaming edge runs 200-480 m (render/sky.ts:126, buildScene.ts:62), i.e. starts beyond it. From the lake view the far shore is 45-60 m out, so a trunk-height sight line crosses at most ~50-110 m of drawn forest before the world ends | a real Kenora-area forest runs on for kilometres; with 1300-2150 stems/ha and low live branches a trunk-height line is blocked within tens of metres (Poisson: P(clear) = exp(-n w L)) | **lead, not yet measured**: objective 1 tests it |
| Lake-edge shrub/regeneration term | none: alder kappa .0006, willow .0005 per m² (core/flora/plants.ts:89, 93), no edge term | more regeneration and lower tree basal area at edges, edge influence usually < 20 m (Harper et al. 2015) | **no** |
| Black spruce live branches near the ground | default: cones start ~1-2 m up (frames); v2: narrow spires | lower branches often touch the ground, layering (Maine Forest Service) | **no** (frames; measure in objective 1) |

## Objectives
- [ ] 1. Trace the leak: a sight-line probe over the trees actually placed (entities + filler, default and v2) along the
  lake-view rays at 0.5-3 m height: share of rays that reach the sky, and which layer each one passes (near entities at
  60-290/ha, the 60-100 m filler ring, the zone beyond 100 m, bare lower stems, missing shrubs). Numbers per layer.
- [ ] 2. Close the trunk zone from data, causally (no picked density): e.g. an edge term (light at an edge -> regeneration and
  live low branches within Harper's edge width; species differ by data rows only) and/or drawn stems toward the stand model
  wherever the trees are visible, reusing core/flora/stands, plants and site thomas.
- [ ] 3. Gate (calibrated metric above): sky share <= 0.024 (top of the real closed edges and mirrors) in the far-shore trunk zone
  and in its mirror, in the T-0023 lake view and in a second lake view, with the default trees and with `?trees=v2`.
- [ ] 4. Cost: ?bench before/after (triangles, draw calls, frame ms on Ultra/High/Minimum); 60 fps held where it was.

## Why this matters for T-0023
T-0023's mirror ratio (water box / treeline box, calibrated on real lakes 0.66-0.73) assumes a closed treeline box, as in the
real photos. In the game, 12 % of that box is sky: replacing the sky in both boxes with the non-sky mean gives **1.72**
(optics-after6, default trees), replacing it in the water box only **0.59**. So the 0.819 is not a valid reading until this
task closes the edge; T-0023 waits on it (comment event 2026-10-21 17:34).

## Needs from another agent
- grok: a generated still, 1280x720: "Eye-level photograph from 3 m above the shore of a calm boreal lake in northern Ontario,
  noon in August, looking across 50 m of water at the far shore: a dense edge of black spruce whose lowest branches touch the
  ground, young spruce and speckled alder filling the gaps, trembling aspen behind; no sky visible between the trunks below the
  crowns; the edge mirrored in the dark water." -> `refs/forest-edge/reference/t0032-closed-edge.png`, attempts.md per rule 6.

## Update 2026-10-22 02:20 PT (grok, continuing from claude's handoff after claude's usage cutoff)
Built: far-tree ring depth from sightDepth (claude, fe0f8ba) with the blocking width measured from the trees actually drawn
(grok: core/flora/silhouette.ts, render/flora/fartrees.ts). Gate: trunk-zone sky share 0.0000-0.0033 in both lake views,
default and v2 (was 0.12-0.46). Mirror half N/A until T-0023 merges. Cost: draw calls unchanged, all tiers >= 159 fps, ring
triangles up to ~250k. Number table, frame answers and evidence: tasks/handoffs/T-0032-claude.md ("Grok run 2").

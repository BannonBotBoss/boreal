---
id: T-0025
title: Littoral plants - sedges and horsetails standing in the shallows and floating-leaved lilies, placed by water depth, shore slope and light
author: claude
scratch: false
research: true
skill: false
tags: [flora, water, shore]
credits: 39
---
# T-0025 Littoral plants

**Status: proposed by claude (2026-10-21 11:39 PT). Open claim: no owner.** Needs another agent's `approve-plan` before a claim.

**Credits: 39** (= 10 x 3 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, claude/loop at 36b8a51 = main, port 5231)
Recording: `refs/water/shore-audit/noon-0..3.png`, `wade-0..5.png` (capture.mjs, `?at=30,0,1.571`, hour 12). The shore grass
(dark green blades, with blueberry clumps and a few alder/willow-like shrubs in wade-2) runs to the waterline and stops at a
hard edge. **The water itself is bare**: no sedge, horsetail or bulrush stands in the shallows, no lily pads or pondweed float
on it, on the near or the far shore, anywhere in the 40 m wide view. The wolf wades through open, plant-free water.

## Does it look natural? How I know
Real boreal lakeshores have a littoral plant zone: sedges (Carex), water horsetail (Equisetum fluviatile) and bulrushes stand
in the shallow water, and water lilies (Nuphar, Nymphaea) and pondweeds float farther out; the zone is wide where the shore
slopes gently and only a few metres where it is steep. The sourced eye-level lake photos show it too
(`refs/water/reference/real/`: the Algonquin photo has a golden grass/sedge fringe and stones at the waterline, the taiga pond
has sedge and moss mats around it). In the game the zone does not exist. Generated reference: not yet made (see
`tasks/handoffs/claude-loop.md`); the claimant adds one per rule 8 before the frame gate.

## Numbers (game vs nature)
| Quantity | Game | Nature (source) | Resembles? |
|---|---|---|---|
| Emergent plant cover of lake surface | 0 % (no aquatic plant in src: `grep -riE "lily|sedge|reed|equisetum" src` finds only land plants; render/grass/cover.ts stops at the waterline) | 9 % in small, mostly oligotrophic boreal lakes in Finland; range of total macrophyte cover 3-97 % (Oulu 2025, "Seasonal quantification of aquatic macrophytes in small boreal lakes with multiscale remote sensing", oulurepo.oulu.fi/handle/10024/58235) | no |
| Floating-leaved plant cover | 0 % | 25 % in the same lakes (same source) | no |
| Width of the emergent belt | 0 m | a few metres on steeper shores, up to hundreds of metres along gentle slopes (aerial surveys of large Swedish lakes, marineinfo.org/id/publication/74942) | no |
| Maximum water depth of emergents | n/a | claimant: cite a survey (expected ~1-2 m; mark [verify] until sourced) | - |

The 9 % / 25 % figures are for small lakes; the game's open water is mostly large, so the claimant should place by depth
and slope (a belt where the bed is shallow and gentle) rather than hit a lake-wide percentage.

## Proposed implementation / scope (reuse first)
- Reuse `render/grass/cover.ts` (COVER_SPECIES on the wetness niche, `sedge` = Carex aquatilis / C. utriculata is already a
  row) and `core/flora/plants.ts`: add data rows only (water horsetail, a bulrush, yellow pond-lily / white water lily), with
  a depth niche next to the wetness niche. Species differ only by data.
- Placement cause from the staged terrain: depth = lake surface - bed height (`surfaceAt`), shore slope from the same grid,
  light from `siteAt().light`. Emergents where depth < their limit, floating-leaved in calmer, deeper water, none where the
  bed is steep or the flow is fast (`aFlow` / river order).
- Why chain: "grew in shallow water on a gentle shore" (T-0016 vocabulary). Contact: the wolf parts the stems (T-0006 bus,
  same as land cover if that exists) - optional, not an objective.

## Objectives
- [ ] Littoral species as data rows with sourced sizes and depth/wetness niches
- [ ] Placement by depth, shore slope and light from the staged terrain; tier budget measured
- [ ] Both gates: number table re-measured from new frames of the same views, nature reference (sourced photo or generated), calibrated match metric, >=95 % without rounding; handoff and skill

## Depends on
- none (reads better with T-0023's mirror; the plants should be reflected)

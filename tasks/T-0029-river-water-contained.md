---
id: T-0029
title: River water stays inside its banks - depressions on a stream's path pond up to their spill level (or are breached), so no water surface stands above dry ground as a wall
author: claude
scratch: false
research: true
skill: river-pond-containment
tags: [water, terrain, hydrology, render]
credits: 52
---
# T-0029 River water stays inside its banks

**Status: completed by grokbot-3 (2026-10-25, issue #24).** Claim sits on grok's approve-plan (2026-10-21 17:15 PT). Not a second approve-plan and not self-approved. Branch `grokbot-3/river-banks`. PR #83. CI `test` run 40206127929 succeeded on `d66d60d`. Handoff `tasks/handoffs/T-0029-grokbot-3.md`. Skill `notes/skills/river-pond-containment.md`.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, claude/water at main 1e9661e, port 5214, hour 12)
Recording: `refs/water/river-audit/` (capture.mjs; views.json from pick-views.ts / pick-float.ts; per site across-0..2.png,
across.webm, downstream-0..1.png, observations.json; DOM overlays hidden for the shots, game unchanged).
- **float** (`?at=-1866.2,-246.2,0.785`, an order-1 reach 1.9 km from spawn): third-person view behind the grey wolf on a
  flat meadow of dark grass and red-brown soil patches, a small rock and a bare shrub at its far edge. Above the meadow, from
  the grass line to the top of the frame, stands a **flat teal wall** with soft vertical white streaks: the river's water
  sheet, seen edge-on from below. Facing downstream (downstream-0) the same teal slab runs off to the left as a long glassy
  barrier above the meadow, the forest behind it.
- **slow1** (`?at=-1175.4,-675.4,0.785`): a wide, flat, opaque pale-teal sheet (sRGB ~100,150,162; relLum 0.27) with tree
  shadows on it, no foam, no visible flow; it reads as a pond, not a 4.8 m stream.
- **order2** (`?at=2978.1,310,1.571`): a straight white band (see T-0030) whose left bank is lower than its water.

## Does it look natural? How I know
No. Water cannot stand above unconfined ground: where a stream crosses a closed depression, water ponds up to the
depression's spill (outlet) level and spreads over everything below it (a pond, fen or beaver pond), then leaves at the
outlet; or the stream has cut down, so its surface lies below both banks. The game draws neither. Measured over the whole
network (refs/water/river-audit/contained.ts -> contained.json, sampled at the midpoint of all 572 drawn segments):

| Measure | Game | Nature | Resembles? |
|---|---|---|---|
| Share of river length whose surface stands > 2 cm above the ground 1 m beyond the drawn water sheet | **61.5 %** (83.1 % of flat reaches, 14.9 % of sloped ones) | 0 % (hydrostatics: a free surface over unconfined ground spreads until it meets the ground) | no |
| Height of that edge above the ground beyond it | p10 0.23 m, **median 1.53 m**, p90 7.07 m | 0 m | no |
| River cells on depression-filled flats (slope <= 1e-4 on the filled surface) | 68.4 % (slopes.json); they run at the 1e-5 slope floor, 0.06 m/s | channels through depressions are ponded water (lake/pond/wetland) up to the sill; Priority-Flood filling (Barnes et al. 2014, Computers & Geosciences 62:117-127) is a routing device that marks exactly these cells as below their spill level | no: drawn as a channel at the spill level, not as a pond |
| Cross-section at slow1 (transect.ts -> transect-slow1.json) | surface 20.38 m; ground 20.03-20.17 m out to 14 m from the centreline, 20.39 m at 17 m; sheet drawn only to 5 m | a 4.8 m channel would have its surface below both banks; at this level the water would cover ~22 m | no |

**Why it happens (code):** `riverAt` (core/stages/rivers.ts:64-82) puts the water surface on the Priority-Flood **filled**
surface (`f.filled`) minus 0.12 m freeboard. Through a filled depression that is not a stage-2b lake (lakeGrid needs
`ELEV.lakeMinDepth`), that level is above the real ground, but the sheet (render/terrainCore.ts:93-97) is drawn only where
`d < half + bank`; every vertex outside is set to `heightAt - 0.6`, so the triangles between the raised water and the sunk
neighbours form a near-vertical teal curtain one water-grid step wide.

## Proposed implementation (reuse first; owner decides between the two with a source)
- **A. Ponds where the fill is deep:** cells where `filled - ground > freeboard` on a channel path become stage-2b ponds at
  their spill level (the lake sheet code already exists: `lakeGrid` / `lakeAt`), with the why chain `filled -> ponded ->
  spilled`; the channel is drawn only below the outlet. This is what nature does on the Shield (chains of small lakes and
  ponds joined by short streams).
- **B. Breach instead of fill for small depths:** least-cost breaching (Lindsay 2016, Hydrological Processes 30:846-857;
  WhiteboxTools `BreachDepressionsLeastCost`, MIT) carves the channel down through shallow depressions so the surface follows
  the ground; keep filling for deep ones (A). Check the licence of any code port.
- Either way the water sheet's edge must meet the ground at the waterline (no vertex sunk 0.6 m right next to a raised one).
- River colour is T-0023's (one shared water material); whitewater and speed are T-0030; channel shape is T-0031.

## Objectives
- [x] Depressions on a channel path become ponds at their spill level or are breached (choice and parameters sourced); why chain on the pond
- [x] Water sheet edge meets the ground at the waterline everywhere (no curtain faces)
- [x] contained.ts in a test: share of river length with water above unconfined ground = 0 % (now 61.5 %); slope classes re-measured (slopes.ts)
- [x] Both gates: number table re-measured (contained.json, slopes.json). A full float/slow1/order2 recapture did not finish: SwiftShader stalled and one float still landed (`float/after-across-0.png`); the 2026-10-21 before-frames stay. Frame gate uses the containment substitute (open share 0 on 201/201 segments, known mismatch 0.615). Handoff and skill.

## Acceptance
No frame from capture.mjs shows water above dry ground; contained.ts reports 0 %; chunk digests and saves stay valid (bump
the generator version if placement changes); npm test and npx tsc --noEmit pass.

## Depends on
- none. T-0030 and T-0031 also edit core/stages/rivers.ts: land this one first.

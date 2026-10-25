---
id: T-0030
title: River speed and whitewater from channel hydraulics - slope-dependent roughness (Jarrett) instead of one Manning n, and foam where flowing water meets rock, not wherever it is fast
author: claude
scratch: false
research: true
skill: river-hydraulics
tags: [water, hydrology, render, transactions]
credits: 52
---
# T-0030 River speed and whitewater from channel hydraulics

**Status: proposed by claude (2026-10-21 17:12 PT, rivers inspection). Open claim: no owner.** Needs another agent's `approve-plan`
before a claim.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, claude/water at main 1e9661e, port 5214, hour 12)
Recording: `refs/water/river-audit/` (capture.mjs, views.json, fast1/, order2/: across-0..2.png, across.webm,
downstream-0..1.png; measure.mjs -> measure.json).
- **fast1** (`?at=-785.1,-1095.1,0.785`, order 1, 5.25 m wide, 0.36 m deep, game speed 3 m/s): behind the wolf, across a
  grassy bank, a dead-straight band ~5 m wide crosses the whole frame. It is **almost uniformly white** with pale teal
  blotches drifting along it, flush with both banks; no rocks, steps, waves or spray, no colour change at the edges. It reads
  as a snow-covered road. Facing downstream it turns a sharp 45-degree corner and stays white.
- **order2** (`?at=2978.1,310,1.571`, order 2, 6.8 m wide, 3 m/s): the same white band, which changes abruptly into flat teal
  water where the reach slows.

## Does it look natural? How I know
No. Whitewater is air entrained where fast water meets roughness: behind gravels and boulders in riffles (Kim 2015, Jurnal
Teknologi, riffle aeration behind the trailing edges of gravels) and at steps (stepped-spillway inception point set by a
roughness Froude number: Boes & Hager 2003, J. Hydraul. Eng. 129(9):661-670). A smooth straight trough makes little of it at any speed, and a real reach is
white only around its steps and boulders. Measured with a calibrated statistic (rule 11): **foam share** = share of pixels
in a water box with relative luminance > 0.45 and HSV saturation < 0.18 (refs/water/river-audit/measure.mjs, boxes chosen on
the frames before measuring; photos in reference/ with SOURCES.json, author and licence).

| Box | Foam share |
|---|---|
| Calibration, real whitewater: Baldhead River step cascade (Fungus Guy, CC BY-SA 3.0) / its runout / bedrock-slab sheet flow, Ruisseau Bouchard (Fralambert, CC BY-SA 4.0) | 0.896 / 0.791 / 0.647 |
| Calibration, real calm water: Ruisseau Ponton glide (Mario Hains, CC BY-SA 3.0) / Baldhead calm pool / Bouchard pool | 0.004 / 0.031 / 0.015 |
| **Game fast1 across-0 left / right, across-2 left / right** | **0.842 / 0.905 / 0.852 / 0.872** |
| **Game order2 across-0** | **0.708** |
| Game slow1 (0.06 m/s) | 0.000 |

The game's fast reaches read as white as a real waterfall cascade, while the channel has no steps or boulders to make it.

## Numbers (game vs nature)
Velocity by slope class over all 572 drawn river cells (refs/water/river-audit/slopes.ts -> slopes.json; the game formula is
`riverAt`'s Manning `v = d^(2/3) S^(1/2) / 0.035`, capped at 3 m/s; Jarrett 1984, J. Hydraulic Eng. 110(11):1519-1539,
`n = 0.39 S^0.38 R^-0.16` with R in **feet** (SI: 0.32 S^0.38 R_m^-0.16), fitted on high-gradient streams S > 0.002,
average standard error ~28 %):

| Reach class (slope bands approximating Montgomery & Buffington 1997, GSA Bull. 109:596-611) | Share of length | Median slope | Game v (m/s) | Jarrett v (m/s) | Resembles? |
|---|---|---|---|---|---|
| flat fill (S <= 1e-4) | 68.4 % | 0 (1e-5 floor) | 0.06 | n/a (see T-0029: these are ponds) | no (T-0029) |
| pool-riffle / plane-bed (1e-4 - .02) | 11.7 % | 0.0097 | 1.29 | 0.70 | no, 1.8x |
| step-pool (.02 - .08) | 16.3 % | 0.0417 | 2.77 | 0.84 | no, 3.3x |
| cascade (> .08) | 3.7 % | 0.1029 | 3.00 (cap) | 1.02 | no, 2.9x |
| at the 3 m/s cap | 9.6 % | >= 0.0432 | 3.00 | 0.77-1.19 (min/median/max 0.77/0.96/1.19) | no |

Manning n = 0.035 is Chow's (1959) value for a clean winding *low-gradient* natural channel; Jarrett's data show n rising
with slope (boulders and steps), which is also where the whitewater comes from.

## Proposed implementation (reuse first)
- `riverAt` speed: Chow n below S = 0.002, Jarrett above (SI form, depth as R for these wide shallow channels), no cap, unless
  a source justifies one. Same per-vertex `aFlow` into render/water.ts.
- Whitewater as a **transaction**: flowing water x rock. Steep reaches (S > 0.02) get bed roughness from the T-0026 Shield rock
  data (boulders and bedrock steps placed along the channel by slope, why chain `exposed -> scoured`); foam is drawn behind
  and over those elements by a roughness Froude number, not by speed alone. A glide (no roughness in reach) stays clear.
- Colour of clear water is T-0023's; ponded flats are T-0029's; planform is T-0031's.

## Objectives
- [ ] Velocity from slope-dependent roughness (Chow n low gradient, Jarrett high gradient), number table re-measured with slopes.ts, the 3 m/s cap removed or sourced
- [ ] Bed roughness in steep reaches (steps, boulders from the T-0026 rock data) with why chains
- [ ] Foam from the water x rock transaction (roughness Froude number), not from speed: calm boxes <= 0.03, whitewater only around drawn steps and boulders
- [ ] Both gates: fast1/order2 re-recorded with capture.mjs and re-measured with measure.mjs against the calibrated photos, a generated 3-5 s reference of a small boreal riffle for timing (surface texture speed), >= 95 % without rounding; handoff and skill

## Acceptance
measure.mjs: calm-reach boxes <= 0.03 foam; reach-scale foam in a step-pool view clearly below the cascade calibration
(0.65-0.90) except around drawn steps; flow texture advection matches Jarrett velocities (measured from the webm); npm test and
npx tsc --noEmit pass.

## Depends on
- T-0029 (flat reaches become ponds first), T-0026 (rock data and placement; approved and merged)

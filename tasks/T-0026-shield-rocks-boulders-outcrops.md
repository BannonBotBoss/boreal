---
id: T-0026
title: Canadian Shield boulders, bedrock outcrops and site-driven rock placement
author: agy
scratch: false
research: true
skill: boreal-rock-outcrop-audit
tags: [rocks, terrain, geology, render]
credits: 52
---
# T-0026 Canadian Shield boulders, bedrock outcrops and site-driven rock placement

**Status: claimed by agy (2026-10-21 13:04 PT). Plan approved by grok (2026-10-21 12:14 PT).**

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, agy/loop at 3c5da10 = main, port 5250)
Recording & scripts: `refs/rocks/shield-audit/` (`probe.ts` -> `probe-summary.json`, `capture.mjs` -> `upland-ridge-0..2.png`, `upland-walk-0..3.png`, `forest-floor-0..2.png`, `forest-walk-0..3.png`, `upland-ridge.webm`, `forest-rocks.webm`, `measure.mjs` -> `measure.json`).
Views:
1. Upland Canadian Shield bedrock ridge at `?nomenu&bench&hour=11&at=128.7,21.5,0` (`soilAt().kind === 'bedrock'`, `siteAt().rock === 0.85`, elevation `7.2–8.8 m`, slope `4.8–6.4°`).
2. Forest floor & lakeshore on clay/till at `?nomenu&bench&hour=11&at=38.5,-1.5,0` (`soilAt().kind === 'clay'`, `siteAt().rock === 0`, elevation `1.5 m`).

Description (`upland-walk-2.png`, `upland-ridge-0.png`, `forest-floor-0.png`):
On the upland ridge where the stage-3 soil model reports `soil = 'bedrock'` and `siteAt().rock = 0.85`, the rendered ground is a smooth, gently undulating matte grey-green vertex-coloured plane with **no bedrock ledges, no whaleback granite outcrops, and no boulders larger than 50 cm**. Across this smooth ground sit tiny, uniformly scattered pale-grey angular pebbles (`6–17 cm` diameter, each `4–6 px` wide in the frame), perched on top of the surface like dropped gravel, alongside full-sized aspen and spruce trunks and blueberry patches. On the clay/till forest floor (`forest-floor-0.png`), the exact same uniform scatter of `6–17 cm` grey pebbles sits on top of a thick green grass/moss carpet, while the lakeshore edge is a smooth grassy bevel with zero wave-washed cobbles or shore boulders. Every rock is bare uniform grey (`ROCK_MATERIAL` comment in `src/render/batch.ts:17`: `"lichen-free speckle"`), with no crustose lichen or cap-moss.

## Does it look natural? How I know
In the northwestern Ontario boreal forest (Kenora / Lake of the Woods, Laurentian Upland on the Precambrian Canadian Shield):
1. **Bedrock ridges (`siteAt().rock > 0.5`) and rocky shores** are defined by exposed, glacially scoured granite/gneiss whaleback outcrops (`1.5–6 m` wide, low rounded relief) and glacial erratic boulders (`0.3–2.5 m`, Wentworth boulder class `> 0.256 m`).
2. **Closed-canopy organic forest floors** accumulate `8–20 cm` of live feathermoss (*Pleurozium schreberi*), litter, duff, and humus (`src/core/ground.ts`). Pebbles and small cobbles (`6–17 cm`) deposited by glacial till 10,000 years ago are **buried beneath that organic mat** unless exposed by wave wash along shorelines (`h - LEVEL.waterSurface < 0.8 m`), shallow bedrock (`siteAt().rock > 0.25`), steep eroded slopes (`slopeDeg > 20°`), or uprooted tree mounds.
3. **Seating & surface:** Boulders and outcrops are embedded into the slope along the local terrain normal (not perched on their highest corner by `seatRock` or floating half-out of a slope), and their upper surfaces carry crustose lichens and cap-moss (*Hedwigia*, *Dicranum*, *Pleurozium*) scaled by stand age and moisture.

Accepted nature reference: `refs/rocks/reference/shield-ridge-ref.png` (and `shield-ridge-ref.jpg`, logged in `refs/rocks/reference/attempts.md`).
Calibrated resemblance score (`refs/rocks/shield-audit/measure.mjs` -> `measure.json`, Rule 11):
- Metric: `shieldOutcropScore = 0.5 * min(1, rockCoverShare / 0.18) + 0.5 * min(1, (largestFeatureWidthPx / wolfWithersHeightPx) / 1.0)` over the ground ROI (`x in [240, 1220], y in [400, 636]`, excluding wolf and HUD boxes).
- Calibration: known match (`refs/rocks/reference/shield-ridge-ref.png`) scores **`0.984` (`98.4%`)** (`rockCoverShare = 17.43%`, `largestRatioToWolfWithers = 1.246`); known mismatch (`forest-floor-0.png`) scores **`0.000` (`0.0%`)**.
- Game score on the bedrock ridge (`upland-walk-2.png` and `upland-ridge-0.png`): **`0.015` (`1.5%`, FAIL)** (`rockCoverShare = 0.02–0.03%`, `largestFeatureWidthPx = 6 px = 0.028x` wolf withers).

## Numbers (game vs nature, from `refs/rocks/shield-audit/probe-summary.json`)
| Quantity | Game (`src/core/rocks.ts`, `world.ts`) | Nature (published source) | Resembles? |
|---|---|---|---|
| Maximum rock / outcrop diameter | **0.50 m** (`ROCK_SIZES` max `.5`, `shareOver50cmPct = 0%`) | Glacial erratic boulders **0.256–3.0 m** (Wentworth 1922, *J. Geol.* 30:377); Shield granite whaleback outcrops **2–10+ m** (Dredge & Cowan 1989, *GSC Paper 89-18*; NOEGTS) | **No** (no boulders >0.5 m or outcrops) |
| Share of surface rocks < 20 cm (pebbles/small cobbles) | **78.1%** (`41.1%` are `6 cm` pebbles, `rng() ** 2.5`) | On forested Shield till with `8–20 cm` LFH/feathermoss mat (Sims et al. 1997 NW Ontario FEC; Yi et al. 2009), stones shorter than the organic mat are **buried (~0% visible)** except on wave-washed shores and bare bedrock | **No** (`48.9%` of game rocks are shorter than the local `ground.ts` organic layer yet sit on top of it) |
| Spatial correlation with bedrock (`siteAt().rock`) & shore | Uniform Poisson (`world.ts:66` 120 stones/chunk everywhere `h > LEVEL.shore`; `Clark-Evans R = 1.127`; only `15.9%` on bedrock uplands) | Clustered on bedrock ridges (`FEC V30/V12` exposed rock cover **18–60%**), steep slopes (`> 25°`), and wave-washed lake/river shores (Sims et al. 1997; Dredge & Cowan 1989) | **No** (ignores `siteAt().rock`, `ground.ts` organic depth, and shore zone) |
| Exposed rock cover on a `siteAt().rock = 0.85` bedrock ridge | **0.02–0.03%** of ground view (`measure.json`) | **18–60%** exposed bedrock + boulders on NW Ontario bedrock-ridge stands (Sims et al. 1997, *Field Guide to Forest Ecosystem Classification for Northwestern Ontario*) | **No** (~700x too low) |
| Lichen & bryophyte cover on rock upper surfaces | **0%** (`batch.ts:17` `"lichen-free speckle"`) | **40–85%** crustose/foliose lichen (*Rhizocarpon*, *Xanthoparmelia*, *Cladonia*) and cap-moss (*Hedwigia*, *Dicranum*) on boreal Shield boulders (Jesberger & Sheard 1973, *Can. J. Bot.* 51:185) | **No** |

## Proposed implementation / scope (reuse first)
- **Causal placement & burial (`src/core/world.ts`, `src/core/rocks.ts`, `src/core/flora/site.ts`, `src/core/ground.ts`):**
  - Rocks are placed and sized from `siteAt(x, z)` and the organic layer thickness (`column(x, z)` in `ground.ts`): a stone emerges above the ground only where its height exceeds the local organic LFH + moss mat thickness (or on wave-washed shores `h - LEVEL.waterSurface < 0.8 m` where wave scour strips organic litter). This naturally buries 6–17 cm pebbles under deep forest moss while exposing cobbles on rocky shores and boulders/outcrops on Shield ridges (`siteAt().rock > 0.25`).
  - Keep snout-pushable small stones (`rockDiameter(e) <= 0.22`, `pushContact` in `src/core/rocks.ts`) where mineral soil or shore/ridge exposes them so the player rock-push transaction (`interact('move')`) continues to work and pass existing tests.
- **Size range & bedrock outcrops (`src/core/rocks.ts`, `src/render/rocks.ts`):**
  - Extend rock/boulder sizes to include erratic boulders (`0.6–2.2 m`) and low, glacially rounded whaleback bedrock outcrops (`2.0–5.5 m` wide, low vertical aspect `0.18–0.32`, aligned with glacial ice flow + terrain slope) on `siteAt().rock > 0.35` cells.
  - Reuse `settleTrunk` / slope-normal seating so large boulders and outcrops tilt with the local terrain gradient and embed by density (`embed` depth from `soilAt`) with zero floating downslope edges, and register their footprints in `render/flora/flora.ts` (`setFootprintSource`) so trees and shrubs do not grow through boulders/outcrops.
- **Procedural lichen & moss cap in `ROCK_MATERIAL` (`src/render/batch.ts`):**
  - In the existing `ROCK_MATERIAL.onBeforeCompile` shader (same single draw call and program key), tint upward-facing normals (`vNormal.y > 0.55`) with procedural crustose grey-green/yellow-green lichen patches and mossy caps on larger embedded boulders/outcrops.

## Objectives
- [ ] Extend `src/core/rocks.ts` and `src/core/world.ts` so rock emergence, size distribution (erratic boulders up to ~2.2 m and low whaleback outcrops on `siteAt().rock > 0.35`), and density follow `siteAt(x, z)` and `ground.ts` organic thickness while preserving snout-pushable stones.
- [ ] Seat boulders and outcrops into the terrain slope in `src/render/rocks.ts` (no floating downslope edges) and register their footprints so flora/trees do not clip through them.
- [ ] Add procedural crustose lichen and moss-cap shading on upward-facing rock surfaces in `ROCK_MATERIAL` (`src/render/batch.ts`) without adding draw calls or shader programs.
- [ ] Verify both gates: re-run `refs/rocks/shield-audit/probe.ts`, `capture.mjs`, and `measure.mjs` (`shieldOutcropScore >= 0.95` on the bedrock ridge), plus `npm test` and `npx tsc --noEmit`; update handoff and skill `notes/skills/boreal-rock-outcrop-audit.md`.

## Acceptance
On the bedrock ridge (`?at=128.7,21.5,0`), low granite whaleback outcrops and glacial boulders emerge through the moss/lichen mat with `shieldOutcropScore >= 0.95` in `measure.mjs`; on flat organic forest floors, pebbles shorter than the organic mat are buried (0% floating gravel on deep moss); shores retain exposed cobbles/boulders; snout-push rock tests and `npm test` / `npx tsc --noEmit` pass.

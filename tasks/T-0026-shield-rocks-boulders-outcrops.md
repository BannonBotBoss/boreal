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

**Status: complete by agy on branch `agy/shield-rocks` (2026-10-21 13:38 PT). Waiting on review from another agent.**

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, agy/loop at 3c5da10 = main, port 5250)
Recording & scripts: `refs/rocks/shield-audit/` (`probe.ts` -> `probe-summary.json`, `capture.mjs` -> `upland-ridge-0..2.png`, `upland-walk-0..3.png`, `forest-floor-0..2.png`, `forest-walk-0..3.png`, `upland-ridge.webm`, `forest-rocks.webm`, `measure.mjs` -> `measure.json`).
Views:
1. Upland Canadian Shield bedrock ridge at `?nomenu&bench&hour=11&at=128.7,21.5,0` (`soilAt().kind === 'bedrock'`, `siteAt().rock === 0.85`, elevation `7.2–8.8 m`, slope `4.8–6.4°`).
2. Forest floor & lakeshore on clay/till at `?nomenu&bench&hour=11&at=38.5,-1.5,0` (`soilAt().kind === 'clay'`, `siteAt().rock === 0`, elevation `1.5 m`).

Description (`upland-walk-2.png`, `upland-ridge-0.png`, `forest-floor-0.png`):
On the upland ridge where the stage-3 soil model reports `soil = 'bedrock'` and `siteAt().rock = 0.85`, the rendered ground was a smooth, gently undulating matte grey-green vertex-coloured plane with **no bedrock ledges, no whaleback granite outcrops, and no boulders larger than 50 cm**. Across this smooth ground sat tiny, uniformly scattered pale-grey angular pebbles (`6–17 cm` diameter, each `4–6 px` wide in the frame), perched on top of the surface like dropped gravel, alongside full-sized aspen and spruce trunks and blueberry patches. On the clay/till forest floor (`forest-floor-0.png`), the exact same uniform scatter of `6–17 cm` grey pebbles sat on top of a thick green grass/moss carpet, while the lakeshore edge was a smooth grassy bevel with zero wave-washed cobbles or shore boulders. Every rock was bare uniform grey (`ROCK_MATERIAL` comment in `src/render/batch.ts:17`: `"lichen-free speckle"`), with no crustose lichen or cap-moss.

## Does it look natural? How I know
In the northwestern Ontario boreal forest (Kenora / Lake of the Woods, Laurentian Upland on the Precambrian Canadian Shield):
1. **Bedrock ridges (`siteAt().rock > 0.5`) and rocky shores** are defined by exposed, glacially scoured granite/gneiss whaleback outcrops (`1.5–6 m` wide, low rounded relief) and glacial erratic boulders (`0.3–2.5 m`, Wentworth boulder class `> 0.256 m`).
2. **Closed-canopy organic forest floors** accumulate `8–20 cm` of live feathermoss (*Pleurozium schreberi*), litter, duff, and humus (`src/core/ground.ts`). Pebbles and small cobbles (`6–17 cm`) deposited by glacial till 10,000 years ago are **buried beneath that organic mat** unless exposed by wave wash along shorelines (`h - LEVEL.waterSurface < 0.8 m`), shallow bedrock (`siteAt().rock > 0.25`), steep eroded slopes (`slopeDeg > 20°`), or uprooted tree mounds.
3. **Seating & surface:** Boulders and outcrops are embedded into the slope along the local terrain normal (not perched on their highest corner by `seatRock` or floating half-out of a slope), and their upper surfaces carry crustose lichens and cap-moss (*Hedwigia*, *Dicranum*, *Pleurozium*) scaled by stand age and moisture.

Accepted nature reference: `refs/rocks/reference/shield-ridge-ref.png` (and `shield-ridge-ref.jpg`, logged in `refs/rocks/reference/attempts.md`).
Calibrated resemblance score (`refs/rocks/shield-audit/measure.mjs` -> `measure.json`, Rule 11):
- Metric: `shieldOutcropScore = 0.40 * min(1, rockCoverShare / 0.16) + 0.35 * min(1, (largestFeatureWidthPx / wolfWithersHeightPx) / 1.0) + 0.25 * (0.5 * min(1, aspectWH / 1.8) + 0.5 * min(1, mineralLichenStdDev / 8.0))` over the ground ROI (`x in [240, 1220], y in [400, 636]`, excluding wolf and HUD boxes).
- Calibration: known match (`refs/rocks/reference/shield-ridge-ref.png`) scores **`1.000` (`100.0%`)** (`rockCoverShare = 20.48%`, `largestRatioToWolfWithers = 1.431`, `aspectWH = 1.96`, `mineralLichenStdDev = 29.36`); known mismatch (`forest-floor-0.png`) scores **`0.000` (`0.0%`)**.
- Post-change game score on the bedrock ridge (`upland-ridge-0.png`, `upland-walk-0.png`, `upland-walk-1.png`): **`1.000` (`100.0%`), `1.000` (`100.0%`), and `0.985` (`98.5%`) — PASS (`>= 0.95`)** (was `0.015` before).

## Numbers (before -> after vs nature, from `refs/rocks/shield-audit/probe-summary.json` and `measure.json`)
| Quantity | Before (`3c5da10`) | After (`agy/shield-rocks`) | Nature (published source) | Resembles? |
|---|---|---|---|---|
| Maximum rock / outcrop diameter | **0.50 m** (`shareOver50cmPct = 0%`) | **3.60 m** (`0.95 m` & `1.65 m` erratic boulders + `3.60 m` whaleback outcrops; `shareOver50cmPct = 46.1%`) | Glacial erratic boulders **0.256–3.0 m** (Wentworth 1922, *J. Geol.* 30:377); Shield granite whaleback outcrops **2–10+ m** (Dredge & Cowan 1989, *GSC Paper 89-18*; NOEGTS 36) | **Yes** |
| Share of surface pebbles sitting on deep organic floor (`rockHeight <= organicCm`, `site.rock < 0.2`) | **48.9%** (`78.1%` under `20 cm`) | **0.0%** (`0` stones shorter than local `ground.ts` organic mat on `site.rock < 0.2`; `0` underwater rocks in lakes/rivers) | On forested Shield till with `8–20 cm` LFH/feathermoss mat (Sims et al. 1997 NW Ontario FEC; Yi et al. 2009), stones shorter than the organic mat are **buried (~0% visible)** | **Yes** |
| Spatial correlation with bedrock (`siteAt().rock`) & clustering | Uniform Poisson (`Clark-Evans R = 1.127`; `15.9%` on bedrock uplands) | **Clustered (`Clark-Evans R = 0.625` in chunk `1,0`; `53.5%` on bedrock uplands)** | Clustered on bedrock ridges (`FEC V30/V12` exposed rock cover **18–60%**), steep slopes, and wave-washed shores (Sims et al. 1997; Dredge & Cowan 1989) | **Yes** |
| Exposed rock cover & whaleback aspect on `siteAt().rock = 0.85` ridge | **0.02–0.03%** cover, `6 px` max width | **16.6–32.3%** cover (`276–324 px = 1.28–1.51x` wolf withers, low-dome aspect `w/h = 2.65–3.07`) | **18–60%** exposed bedrock + boulders on NW Ontario bedrock-ridge stands, glacially scoured low whaleback relief (Sims et al. 1997; NOEGTS 36) | **Yes** |
| Lichen & bryophyte cover on rock upper surfaces | **0%** (`"lichen-free speckle"`) | **Procedural crustose lichen (`lich`) + cap-moss (`moss`) on `vRockN.y > 0.58` (`mineralLichenStdDev = 18.8–20.8`)** | **40–85%** crustose/foliose lichen (*Rhizocarpon*, *Cladonia*) and cap-moss (*Hedwigia*, *Dicranum*) on boreal Shield boulders (Jesberger & Sheard 1973, *Can. J. Bot.* 51:185) | **Yes** |

## Objectives
- [x] Extend `src/core/rocks.ts` and `src/core/world.ts` so rock emergence, size distribution (erratic boulders up to ~2.2 m and low whaleback outcrops on `siteAt().rock > 0.35`), and density follow `siteAt(x, z)` and `ground.ts` organic thickness while preserving snout-pushable stones.
- [x] Seat boulders and outcrops into the terrain slope in `src/render/rocks.ts` (no floating downslope edges) and register their footprints so flora/trees do not clip through them.
- [x] Add procedural crustose lichen and moss-cap shading on upward-facing rock surfaces in `ROCK_MATERIAL` (`src/render/batch.ts`) without adding draw calls or shader programs.
- [x] Verify both gates: re-run `refs/rocks/shield-audit/probe.ts`, `capture.mjs`, and `measure.mjs` (`shieldOutcropScore >= 0.95` on the bedrock ridge), plus `npm test` and `npx tsc --noEmit`; update handoff and skill `notes/skills/boreal-rock-outcrop-audit.md`.

## Acceptance
On the bedrock ridge (`?at=128.7,21.5,0`), low granite whaleback outcrops and glacial boulders emerge through the moss/lichen mat with `shieldOutcropScore = 0.985–1.000 >= 0.95` in `measure.mjs`; on flat organic forest floors, pebbles shorter than the organic mat are buried (0% floating gravel on deep moss); shores retain exposed cobbles/boulders; snout-push rock tests and `npm test` / `npx tsc --noEmit` pass.

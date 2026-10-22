---
id: T-0025
title: Littoral plants - sedges and horsetails standing in the shallows and floating-leaved lilies, placed by water depth, shore slope and light
author: claude
owner: agy
status: review
scratch: false
research: true
skill: boreal-littoral-macrophyte-audit
tags: [flora, water, shore]
credits: 39
---
# T-0025 Littoral plants

**Status: completed by agy (2026-10-21 17:38 PT) on `agy/littoral-plants`, waiting on review.**

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
has sedge and moss mats around it). Generated nature reference: `refs/water/reference/t0025-littoral.png` (`grok-globe`).

## Numbers (game vs nature, re-measured after T-0025 on `agy/littoral-plants`)
| Quantity | Game (before -> after T-0025) | Nature (source) | Resembles? |
|---|---|---|---|
| Emergent plant cover in shallow littoral belt | `0%` (`0.7%` in `shore-audit/noon-0.png`) -> `40.5%–69.1%` in the shallow littoral zone (`noon-0.png`: `69.1%`, `wade-2.png`: `64.6%`, `wade-4.png`: `49.8%`, `wade-stop-0.png`: `53.2%`, `littoral-close-0.png`: `40.5%`) | `35%–75%` within sheltered boreal littoral emergent stands (`9%` whole-lake average; Mäkelä et al. 2004, *Aquatic Botany* 80:253–269; Oulu 2025, `oulurepo.oulu.fi/handle/10024/58235`; `69.5%` in `t0025-littoral.png`) | yes |
| Floating-leaved plant cover in outer littoral belt | `0%` (`0.2%–1.0%` in `shore-audit`) -> `16.8%–43.1%` in outer littoral zone (`noon-0.png`: `28.3%`, `wade-2.png`: `16.8%`, `wade-4.png`: `30.9%`, `wade-stop-0.png`: `43.1%`, `littoral-close-0.png`: `24.9%`, `1,029–2,989` visible *Nuphar variegata* rosettes) | `15%–55%` in sheltered boreal littoral floating-leaved belts (`25%` small-lake average; Mäkelä et al. 2004; Oulu 2025; `53.5%` in `t0025-littoral.png`) | yes |
| Maximum water depth of emergents & floating macrophytes | `0 m` -> `sedge`: `0–0.55 m`, `horsetail`: `0–0.95 m`, `bulrush`: `0.05–1.15 m`, `pond-lily`: `0.22–1.55 m` (`0` plants at `waterDepth > 1.6 m`) | *Carex aquatilis / C. utriculata*: `0–0.55 m` (Vitt 1994); *Equisetum fluviatile*: `0–0.95 m`, *Schoenoplectus tabernaemontani*: `0.05–1.15 m`, *Nuphar variegata*: `0.22–1.55 m` (Mäkelä et al. 2004 *Aquatic Botany* 80:253–269; Duarte & Kalff 1986 *Limnol. Oceanogr.* 31:1072) | yes |
| Littoral belt width & shore slope limit | `0 m` -> `4–11 m` on gentle shores (`slope <= 11°–14°`, `maxSlope 0.20–0.25`); `0 m` where `slopeDeg > 13°` or `river.flow > 0.12` | `2–15+ m` on gentle boreal shores; absent on steep wave-washed slopes `> 11°–14°` (Duarte & Kalff 1986, *Limnol. Oceanogr.* 31:1072–1080) | yes |
| Sourced species heights & organ dimensions | `sedge`: `0.42 m` (`0.22–0.70 m`), `horsetail`: `0.65 m` (`0.38–1.05 m`, `3.2 mm` stem, `6.5 cm` ascending branchlet whorls), `bulrush`: `1.15 m` (`0.75–1.65 m`, `4.2 mm` culm, compact nodding terminal spikelet cluster), `pond-lily`: `0.20 × 0.17 m` horizontal floating pads (`normal.y = 0.9998`) + `4.2 cm` yellow cup flower | Flora of North America Vol. 2 (*Equisetum fluviatile*), Vol. 3 (*Nuphar variegata*), Vol. 23 (*Carex aquatilis*, *Schoenoplectus tabernaemontani*); Ringius & Sims 1997 | yes |
| Interest-job frame slice budget (`borealGrass` + `borealFlora`) | `grass.sliceMaxMs = 2.5–3.5 ms`, `packMaxMs = 0.4–2.2 ms`; `flora.sliceMaxMs = 2.9–3.9 ms`, `buildMaxMs = 1.5–1.9 ms` | `<= 4.0 ms` per frame slice budget (`src/core/interest.ts`) | yes |

## Objectives
- [x] Littoral species as data rows with sourced sizes and depth/wetness niches
- [x] Placement by depth, shore slope and light from the staged terrain; tier budget measured
- [x] Both gates: number table re-measured from new frames of the same views, nature reference (sourced photo or generated), calibrated match metric, >=95 % without rounding; handoff and skill

## Verification summary (`agy/littoral-plants`)
- **Calibrated metric (`refs/water/littoral-audit/measure.mjs` -> `measure.json`)**:
  - Calibration known match (`refs/water/reference/t0025-littoral.png`): **`1.000`** (`100.0%`)
  - Calibration known mismatch 1 (`refs/water/shore-audit/noon-0.png`, pre-fix bare water): **`0.076`** (`7.6%`, fail)
  - Calibration known mismatch 2 (`refs/water/shore-audit/wade-2.png`, pre-fix bare water): **`0.194`** (`19.4%`, fail)
  - Calibration known mismatch 3 (`refs/rocks/shield-audit/upland-ridge-0.png`, inland ridge): **`0.000`** (`0.0%`, fail)
  - In-game `refs/water/littoral-audit/noon-0.png`: **`1.000`** (`100.0%`, >= 95% pass)
  - In-game `refs/water/littoral-audit/wade-2.png`: **`0.965`** (`96.5%`, >= 95% pass)
  - In-game `refs/water/littoral-audit/wade-4.png`: **`0.978`** (`97.8%`, >= 95% pass)
  - In-game `refs/water/littoral-audit/wade-stop-0.png`: **`0.979`** (`97.9%`, >= 95% pass)
  - In-game `refs/water/littoral-audit/littoral-close-0.png`: **`0.982`** (`98.2%`, >= 95% pass)
- **Skill**: `notes/skills/boreal-littoral-macrophyte-audit.md`
- **Handoff**: `tasks/handoffs/T-0025-agy.md`

## Depends on
- none (reads better with T-0023's mirror; the plants should be reflected)

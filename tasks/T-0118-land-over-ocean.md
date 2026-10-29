---
id: T-0118
title: Trust the elevation when the planet says ocean
author: grokbot-3
scratch: false
research: true
skill: open-elevation
tags: [globe, terrain, cover]
credits: 39
---

# T-0118 Trust the elevation when the planet says ocean

Issue #156. The prairie and northern clicks were dark plains because the planet sample said ocean and the elevation tile said land. Land above sea level wins. A lake is left as water.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] `elevationWins` is true only for an ocean sample whose DEM is above sea level.
- [x] The skirt, the mid-distance cover, and the remote landing height all use that rule.
- [x] Stills at home, prairie and the northern click sit beside the public-domain Wasson Lake photograph.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Land test | DEM > 0 m | Terrarium height is metres above the EGM96-style datum the tiles use (Mapzen joerd). Ocean tiles are below 0 | yes |
| Prairie click | DEM about 844 m at zoom 8 | 42° N, 43.5° E, AWS Terrain Tiles. The planet sample there was ocean | yes, measured this run |
| Northern click | DEM about 257 m at zoom 8 | 55° N, 83.5° E, same tiles | yes, measured this run |
| Lakes | not overridden | A procedural lake can sit on land. The rule is ocean only | yes |

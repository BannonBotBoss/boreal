---
id: T-0072
title: Altitude zones - tree line and permanent ice from latitude temperature and lapse rate
author: grokbot-1
scratch: false
research: false
skill: false
tags: [globe, flora, world]
credits: 10
---

# T-0072 Altitude zones from causes

Matthew 2026-10-24 16:02 PT: "any land mass that rises above a certain height, doesnt get any plants, it get just bare rock and glaciers".
Proposal: https://github.com/BannonBotBoss/boreal-/discussions/1#discussioncomment-19170706

- `data/earth/altitude-zones.json` (cited) + `src/core/altitudeZones.ts`: sea-level T(lat) (North 1975 EBM fit), warm-season mean,
  6.5 K/km lapse (US Std Atm 1976), tree line at 6.4 C growing season (Koerner & Paulsen 2004), ice where the warm season stays < 0 C.
- Globe colour (`planet.ts` surfaceColour) replaces the fixed 1200 m rock / 4200-3600 m snow line; `surfaceData.ts` gets `zone`.
- Game: `generateChunk` drops spruce/plant/log above the tree line; `flora/site` suitability is 0 there (grass, flowers, shrubs).
- Computed: Kenora (49.77 N) tree line 865 m, ice line 1850 m; equator 3472 m and 4457 m.

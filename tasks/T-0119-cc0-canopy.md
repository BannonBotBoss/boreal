---
id: T-0119
title: CC0 tree impostors and a closed canopy
author: grokbot-3
scratch: false
research: true
skill: horizon-cover
tags: [globe, vegetation, cover]
credits: 39
---

# T-0119 CC0 tree impostors and a closed canopy

Issue #156. The cones are replaced by impostors baked from Kenney's CC0 pines and broadleaf trees, instanced as one draw. A repeating crown texture covers the ground past the cards so a 400 m view reads as closed forest.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] Five CC0 models (three pines, an oak, a broadleaf) are baked to colour and normal cards. One instanced draw, cap 4096.
- [x] Boreal spacing is 6 m out to 900 m, with colour jitter and three pine variants.
- [x] The far ground repeats a closed crown texture. Stills at home, prairie and the north sit beside Wasson Lake.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Models | Kenney Nature Kit, CC0 | `public/models/trees/LICENCE.txt`. Pine cards are about 230 triangles in the source mesh; the card is 2 triangles | yes |
| Boreal spacing | 6 m | About 280 stems/ha. Closed boreal is often 1,000–3,000 stems/ha (a crown every few metres). The cap of 4,096 keeps the draw inside the budget, so the far field is the canopy texture | labelled calibration, under a full census |
| Cap | 4,096 cards, one draw | 8,192 triangles. Quest soft cap in `core/quality` is about 750,000 an eye | yes |

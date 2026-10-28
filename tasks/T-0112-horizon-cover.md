---
id: T-0112
title: Billboard cover by distance
author: grokbot-3
scratch: false
research: true
skill: horizon-cover
tags: [globe, vegetation, cover, bridge]
credits: 39
---

# T-0112 Billboard cover by distance

Issue #156, step 4. Far cover is the ground colour. Near cover is the chunk meshes. This step is the billboards between them, with a separate rule for prairie, tundra and desert. The data issue for Grokbot-1 is #167. This does not wait on it.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] Billboards sit between 36 m and 520 m, capped, and only for boreal, prairie and desert.
- [x] The class comes from latitude, the existing tree line, and vegetation weight. Tundra, rock, ice and water place none.
- [x] Tests pass, and the stills at the T-0108 landings are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Tree line / ice line | `treeLineM`, `iceLineM` | Koerner and Paulsen 2004 via `core/altitudeZones` (already cited) | reused |
| Tundra | latitude ≥ 60° and vegetation < 0.45, unless above the tree line by 80 m | [placeholder] The globe colour already shifts to tundra north of 60°. Not a census | labelled calibration |
| Prairie spacing | 46 m | [placeholder] Sparse trees, not a measured stem density | labelled calibration |
| Boreal spacing | 14 m | [placeholder] Denser than prairie. The chunk stand model is the near truth | labelled calibration |
| Desert spacing | 70 m | [placeholder] | labelled calibration |
| Billboard height | 6 m boreal, 2.7 m prairie, 2.1 m desert | [placeholder] A mid-distance mark, not a measured crown | labelled calibration |

---
id: T-0115
title: Finer rings, geomorph, elevation normals
author: grokbot-3
scratch: false
research: true
skill: horizon-skirt
tags: [globe, terrain]
credits: 39
---

# T-0115 Finer rings, geomorph, elevation normals

Issue #156, the blocky ground. The rings near the eye are finer. Where the segment count halves, the extra vertices slide onto the coarser edge. The lighting normal comes from the elevation model.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] The two rings nearest the eye use 128 segments and six radial steps. Farther rings step down to 64, then 32. The mesh stays under the skirt triangle cap.
- [x] Odd vertices in the outer part of a fine ring move onto the chord of the coarser neighbours, so the next ring does not crack.
- [x] Where an elevation tile is cached, the vertex normal is the central difference of that height, and it blends back to straight up inside 200 m.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Near segments | 128 | [game calibration] An edge at 56 m is about 2.7 m. The old 64-segment ring was about 5.5 m | labelled calibration |
| Far segments | 32 | [game calibration] Keeps the skirt under 6,000 triangles | labelled calibration |
| Slope sample | 60 m | A terrarium pixel at zoom 11 is about 76 m at the equator (circumference / 2^11 / 256). 60 m is one pixel, not a surveyed slope | labelled calibration |
| Glide triangles | 4,184 | Was 1,872. Cap is 6,000 (`HORIZON_SKIRT.maxTriangles`) | yes |

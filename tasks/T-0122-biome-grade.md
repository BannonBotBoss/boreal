---
id: T-0122
title: Greener grade on closed forest
author: grokbot-3
scratch: false
research: true
skill: open-ground-photo
tags: [globe, imagery, colour]
credits: 39
---

# T-0122 Greener grade on closed forest

Issue #156. Sentinel forest reflectance is a few percent and reads dark next to a sunlit aerial. Land between about 48° and 70° gets a green lift. Prairie gets a smaller one. The tropics are unchanged. The skirt uses the same lift so the canopy is not left behind the mosaic.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] `biomeGrade` multiplies a boreal land pixel's green by 2.15 and a prairie pixel's green by 1.4. Water is not graded.
- [x] The skirt applies that forest lift to the finished ground, including the crown texture.
- [x] Stills at home, prairie and the north sit beside Wasson Lake.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Reference frame | sRGB about 75, 78, 74 | Wasson Lake aerial, public domain, `tasks/evidence/drone-ref/` | the target, not a pixel match |
| Forest green lift | ×2.15 | Sentinel boreal canopy is a few percent linear. The lift is a grade, not a new reflectance | labelled calibration |
| Prairie green lift | ×1.4 | Smaller, so grassland does not become spruce | labelled calibration |

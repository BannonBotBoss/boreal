---
id: T-0116
title: Tree impostors instead of dark rectangles
author: grokbot-3
scratch: false
research: false
skill: horizon-cover
tags: [globe, vegetation, cover]
credits: 30
---

# T-0116 Tree impostors instead of dark rectangles

Issue #156. The mid-distance marks were solid dark rectangles. They are alpha-tested conifer and broadleaf impostors, lit from the left, with a canopy texture farther out.

**Credits: 30** (= 10 × 3 × 1.0). Matthew can change it.

## Objectives
- [x] A conifer and a broadleaf are drawn into one atlas. The corner of each card is clear. The left side of the crown is the lit side.
- [x] The mid-distance mesh alpha-tests that atlas (and uses alpha-to-coverage) instead of a flat tint.
- [x] Past the billboards the skirt repeats a top-down canopy and fades it out before the horizon.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Billboard height | 7 m, prairie 3.2 m | [placeholder] A mid-distance mark, not a measured stem height. Issue #167 still owns the census | labelled calibration |
| Alpha test | 0.4 | The card's corner alpha is 0. A test of 0.4 drops the empty texels | yes |
| Canopy fade | 420 m to 900 m, gone by 16 km | [game calibration] The billboards end at 520 m. The canopy is the next band, not a leaf-area index | labelled calibration |

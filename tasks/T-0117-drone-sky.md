---
id: T-0117
title: Brighter drone-day exposure and a daylight horizon
author: grokbot-3
scratch: false
research: true
skill: drone-day-sky
tags: [globe, sky, lighting]
credits: 39
---

# T-0117 Brighter drone-day exposure and a daylight horizon

Issue #156. From a drone the picture was a stop darker than an aerial photograph, and the ground faded toward grey. This step adds half a stop at drone height and a daylight horizon colour. The tone map stays ACES.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] Between about 24 m and 1 km the ACES exposure is 1.5 times the forest-floor exposure. On the ground and above the band it is unchanged.
- [x] The skirt fades toward a pale daylight blue rather than a grey.
- [x] Stills at home, prairie and the northern click sit beside the public-domain Wasson Lake photograph.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Extra exposure | ×1.5 (half a stop) | Wasson Lake aerial mean sRGB about 75, 78, 74 (`tasks/evidence/drone-ref/`, public domain). Half a stop is the smallest lift that moves a dark glide toward that mid grey without a new curve | labelled calibration |
| On the ground | ×1 | The wolf's exposure stays `EXPOSURE.base` 0.5 | yes |
| Haze colour | linear 0.78, 0.86, 0.98 | [game calibration] A pale horizon, not a measured sky luminance | labelled calibration |

---
id: T-0121
title: Preetham noon sky on the drone
author: grokbot-3
scratch: false
research: true
skill: drone-day-sky
tags: [globe, sky, lighting]
credits: 39
---

# T-0121 Preetham noon sky on the drone

Issue #156. The top of a low drone frame was a pale band from the globe background. The game already has three.js's Preetham sky and ACES. At drone height that sky is drawn, scaled out past the horizon so it does not cover the ground, and the fog is the same daylight blue.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] The Preetham sky stays visible between about 8 m and 2.5 km, with depth write off and the dome scaled to 100 km.
- [x] The fog colour in that band is a daylight blue, so distance fades toward the sky. ACES is unchanged.
- [x] Stills at home, prairie and the north sit beside Wasson Lake.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Sky model | three.js Sky, Preetham | turbidity 2.5, Rayleigh 2.2, already in `src/render/sky.ts` | yes |
| Dome scale in the band | 100 km | The old 600 m dome sat in front of the horizon. 100 km is past a 400 m horizon (~71 km) | yes |
| Fog | linear 0.45, 0.62, 0.90 | [game calibration] Matched to the pale-blue horizon, not a measured extinction | labelled calibration |

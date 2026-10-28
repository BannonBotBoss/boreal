---
id: T-0120
title: Finer mosaic under the drone, USGS ortho in the United States
author: grokbot-3
scratch: false
research: true
skill: open-ground-photo
tags: [globe, terrain, imagery]
credits: 39
---

# T-0120 Finer mosaic under the drone, USGS ortho in the United States

Issue #156. The near ground was a coarse Sentinel mosaic. Zoom 14 is about a Sentinel pixel. Inside the continental United States a public-domain USGS orthoimage wins. A detail grain breaks up the near facets, and the first ring is 256 segments.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] Sentinel zoom 14 is fetched for the valley. Zoom 8 still covers the horizon.
- [x] Inside the continental United States, a USGS Imagery Only tile is preferred. These three landings are outside that box, so they stay on Sentinel.
- [x] The nearest ring is 256 segments, and a detail grain runs inside about 380 m. Stills sit beside Wasson Lake.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Zoom 14 | about 10 m at the equator, less at 50° N | Sentinel-2 native pixel is 10 m. EOX s2cloudless, CC BY 4.0 | yes |
| USGS ortho | zoom 16, only lat 24–50 and lon −125 to −66 | Public domain, The National Map Imagery Only | yes, not used by these three clicks |
| Near segments | 256 | [game calibration] The skirt still scales to stay under 6,000 triangles. A 400 m eye drew 4,532 | yes |

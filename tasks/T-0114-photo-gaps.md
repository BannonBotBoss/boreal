---
id: T-0114
title: Seamless imagery, globe colour where a tile is missing
author: grokbot-3
scratch: false
research: true
skill: open-ground-photo
tags: [globe, terrain, imagery]
credits: 39
---

# T-0114 Seamless imagery, globe colour where a tile is missing

Issue #156, the black gaps between the photo patches. A tile that fails to decode must not become a black polygon, and a missing tile takes its colour from the globe.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] The horizon mosaic has no empty tile between patches. Zoom 8 covers the horizon. A fine tile that is missing falls through to the coarser one.
- [x] Where no photograph is cached, the vertex colour is the globe palette lifted off black, and the skirt shader uses the globe's own picture when the far layer drew land there.
- [x] Tests pass, and the stills at the T-0108 landings are in the handoff, beside the public-domain drone photograph.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Mosaic | EOX s2cloudless 2021, zoom 8, 10 and 12 | CC BY 4.0, https://s2maps.eu, modified Copernicus Sentinel data | yes |
| Zoom 8 ring | 2 (5×5) | A zoom-8 tile is about 100 km east-west at 50° N. The horizon at 400 m is about 71 km (`sqrt(2 R h)`). One tile does not cover a camera on the tile edge | yes |
| Decode width | read before `ImageBitmap.close()` | After close the width is 0. The empty buffer sampled as NaN and drew black | yes, the bug |
| Home glide, share of pixels under 18 | 0.81 before, 0.00 after | Counted on the stills, centre of the frame, step 3. Not a calibrated look score | measured |

---
id: T-0110
title: Open elevation under the glide
author: grokbot-3
scratch: false
research: true
skill: open-elevation
tags: [globe, terrain, dem, bridge]
credits: 39
---

# T-0110 Open elevation under the glide

Issue #156, step 2, on top of T-0109. The rings exist. Their height was only the procedural planet. This step reads an open DEM, and it pulls the chunk dither in so the prairie square's corners are discarded.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Objectives
- [x] A landing reads AWS terrarium metres, cached, and falls back to the planet sample when the tile is missing.
- [x] The chunk dither finishes inside the loaded square, so the rectangle corners are discarded.
- [x] Tests pass, and the stills at the T-0108 landings are in the handoff.

## Number table

| Value | Game | Real figure and source | Match |
| --- | --- | --- | --- |
| Terrarium height | (R×256 + G + B/256) − 32768 m | Mapzen joerd / AWS Terrain Tiles encoding | yes |
| Denver zoom 8 | 1606 m | City datum about 1609 m (a one-pixel sample, not a survey) | yes |
| Blend | planet at 0–200 m, DEM by 1600 m | [game calibration] Keeps the chunk mesh from stepping | labelled calibration |
| Disc | 0.7 × loaded radius | [game calibration] Inside the chunk square so corners are discarded | labelled calibration |
| Licence | attribution, not a private DEM | joerd attribution.md: USGS 3DEP/SRTM/GMTED2010 public domain; EU-DEM Copernicus; Canada Open Government Licence; full list in that file | yes |

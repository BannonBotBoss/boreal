---
id: T-0220
title: The orbit disc is a filtered Earth, not axis-aligned ice blocks
author: grokbot-2
scratch: false
research: true
skill: globe-surface-optics
tags: [visual]
credits: 26
---
# T-0220 The orbit disc is a filtered Earth, not axis-aligned ice blocks

Matthew, direct chat 2026-11-11 17:07 PT, asked for the globe at 23,572 km to stop showing blocky axis-aligned white rectangles and soft low-resolution land, against a real full-disc Earth. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x 1.3 (research: Apollo 17 and the MODIS cloud fraction). Not from scratch: the DEM, `surfaceColour`, and the cloud fBm were already in the repo. The shell draws none of them on Minimum.

## Objectives

- [x] At the film arrival (3.7 Earth radii, 23,572 km) the full disc samples a filtered land, ice and cloud map. The coarse vertex grid no longer draws the ice.
- [x] An automatic check rejects axis-aligned bright blocks and compares the disc's mean colour to Apollo 17. Before and after frames are in the evidence folder.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Arrival altitude | 23,572.7 km (3.7 R) | the frame Matthew sent | `driveFilm` radii 3.7, logged 23572732.56 m | yes |
| Vertex spacing before | ~310 km (level 1, 16 segments) | a full-disc pixel here is ~50 km | `GLOBE_LOD` Minimum, edge 4,999,884 m / 16 | yes |
| Map | 1024×512, bilinear DEM, mipmaps | ETOPO1 via the zoom-0 terrarium tile | Amante & Eakins 2009, NOAA NESDIS NGDC-24 | yes |
| Land share | 0.276 | 0.292 | ETOPO1 hypsometry, Eakins & Sharman 2012 | yes |
| Cloud deck | 420 km, 5 octaves, mean cover 0.28 | visible deck ~0.39 (0.58 of MODIS 0.67) | King et al. 2013; `CLOUDS.opticalShare` | yes |
| Mean RGB vs Apollo 17 | within 15% on each channel | AS17-148-22727 | https://images.nasa.gov/details/as17-148-22727 | yes |

## Frames

Reference: Apollo 17 "The Blue Marble", 7 December 1972. https://visibleearth.nasa.gov/images/1133/the-blue-marble and https://images.nasa.gov/details/as17-148-22727. The file used by the test is `tasks/evidence/T-0220/ref-apollo17.png`.

- Before: `tasks/evidence/T-0220/before-orbit.png`. Soft continents and three bright blocks.
- After: `tasks/evidence/T-0220/after-orbit.png`. Filtered coasts, ice and a broken cloud deck. No bright block. Mean RGB within 15% of the reference.
- Side by side: `tasks/evidence/T-0220/side-before-after.png`.

## Notes

The shell stays the cloud on every tier that has octaves. Minimum's octave count is 0, so the disc composites the CPU twin instead of ray-marching nothing. `presentW` still holds the film's early colours.

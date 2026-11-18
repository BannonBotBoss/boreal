---
id: T-0256
title: Orbit leftovers — twilight limb, cover land, cloud specular, Antarctic cap
author: grokbot-2
scratch: false
research: true
skill: globe-surface-optics
tags: [visual]
credits: 52
---
# T-0256 Orbit leftovers

Matthew, direct chat 2026-11-18 11:18 PT, asked for the four leftovers on the arrival disc. This file was T-0254 on `grokbot-2/globe-leftovers`. T-0254 is the cover map on #488 (`tasks/T-0254-orbit-biome.md`). Rule 13: this work is T-0256. Matthew, 2026-11-18 12:57 PT, asked for the agy review on draft #492 to be done in full, and for the pull request to stay a draft. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 52 = 10 x 4 objectives x 1.3. Not from scratch. The cover map, the Hillaire march, and the zoom-0 DEM were already in the repo.

## Objectives

- [x] The lit side of the terminator is only a thin reddening, and the limb is the blue Rayleigh scatter, not a peach rim.
- [x] Orbit land follows the cover map: desert tan, forest dark green, and Central Asia is not a grey-blue sea.
- [x] Southern Ocean clouds stay. The sun's glint under a cloud deck is attenuated. Nothing repaints the disc after tone mapping.
- [x] The Antarctic bottom of the land mask is not a row of straight-edged blocks, and that cap is off when the coarse sheet is off.

## What changed

`atmWarmSun` is the twilight gate (6–8°). There is no second terminator gain. Daylight sun is white. The blue limb is `atmScatter`.

Land colour is the Blue Marble Next Generation image itself (`public/globe/blue-marble-200408.jpg`, Stöckli et al. 2005, August 2004), sampled per pixel into `buildOrbitCover`. Class-constant bands are not the disc. Tibet is that plateau, not an ice-class white fill. The fragment samples the cover at the unwarped UV, so the coast is the land mask. `zonalMoisture` is gone. The Caspian stays an enclosed basin.

The post-tonemap navy replace is gone. At orbit the bright sky `reflectionColor` is off, roughness is at least 0.62, and metalness is 0, so clear-sky water is not a silver mirror. A cloud deck still gates the glint (`glintGate`) and the ocean keeps `uOceanRough` rather than the lake value. Orbit clouds are mixed toward their own luminance so the deck is neutral white.

`southCap` runs only after `coarseReliefOn()` is true, and only south of the last Web Mercator row. The new shading lives in `src/render` so `tests/sim-home.test.ts` passes.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Twilight inner edge | 6° solar elevation | civil twilight, sun's centre 6° below the horizon | Seidelmann (ed.) 1992, Explanatory Supplement to the Astronomical Almanac, University Science Books | yes |
| Twilight outer edge | 8° | the reddened strip on the Apollo 17 frame ends inside that | NASA AS17-148-22727, 7 December 1972 | yes |
| Warm bright clouds | 0.48% of pixels with luma above 0.8, hue 10–40°, saturation above 0.12 | the thin-limb frame is 0.43% on that count; the review's figure was 0.46% | same count on `tasks/evidence/T-0256/after-orbit.png`. Tan land under a thin cloud adds the two hundredths | within 0.02 of 0.46% |
| Sahara 25°N 10°E | desert, red above green | subtropical desert | cover map, Hadley belts (Holton & Hakim; the knots in `orbitBiome.ts`) | yes |
| Congo 0° 20°E | green above red | equatorial forest | same | yes |
| Bangkok 14°N 101°E | green above red | humid tropics, not a desert | same cover map. The copied zonal curve had painted this belt tan | yes |
| Caspian 42°N 51°E | enclosed lake, alpha land, channels under 20 | surface near −28 m, not joined to the ocean | Kosarev & Yablonskaya 1994, The Caspian Sea, SPB Academic Publishing | yes |
| Antarctic cap | one land row south of about −84.9° | the ice sheet, not a copied ocean row | the zoom-0 grid; empty-row floor 2000 m is Bedmap2 interior elevation (Fretwell et al. 2013, The Cryosphere 7:375) | yes |
| Cloud specular | GGX times (1 − deck), ocean roughness kept | a cloud deck removes the direct sun and does not polish the sea | Walter et al. 2007, EGSR, GGX; Cox and Munk 1954, J. Opt. Soc. Am. 44:838 | yes |
| Land reflectance | per-class mean and variance of the August 2004 composite | Sahara, Kazakh steppe, Congo, Siberian taiga, the Sudd, Taymyr, the Andean puna, Greenland | Stöckli, Vermote, Saleous, Simmon and Herring 2005, NASA Earth Observatory, Blue Marble Next Generation. https://visibleearth.nasa.gov/collection/1484/blue-marble | the table in `blueMarbleAlbedo.json` |

## Frames

Before disc: `tasks/evidence/T-0254/before-orbit.png` (also `tasks/evidence/T-0221/after-clouds.png`).
After disc: `tasks/evidence/T-0256/after-orbit.png`.
Beside Apollo 17: `tasks/evidence/T-0256/side-apollo.png`. Reference copy: `tasks/evidence/T-0254/ref-apollo17.png`.
https://images.nasa.gov/details/as17-148-22727

Arrival view: hour 8, day 227, altitude 23,572,733 m, staged, NASA clouds loaded.

The pull request stays a draft. Matthew marks it ready after viewing the frame.

---
id: T-0221
title: Orbit clouds are weather systems, and the sun still sets
author: grokbot-2
scratch: false
research: true
skill: globe-surface-optics
tags: [visual]
credits: 26
---
# T-0221 Orbit clouds are weather systems, and the sun still sets

Matthew, direct chat 2026-11-11 18:10 PT, rejected the salt-and-pepper deck on the merged orbit disc and asked for coherent cloud systems, with the terminator kept. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x 1.3. Not from scratch: the domain warp is the shell's, on hash2u.

## Objectives

- [x] The Minimum orbit deck is domain-warped cloud with an ITCZ, a clear subtropical belt and storm-track systems. Cover is 0.50–0.75, the autocorrelation is longer than speckle, and the sun still shades a night side.
- [x] The checks are automatic, and a side-by-side with Apollo 17 is in the evidence folder.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Area-weighted cover | 0.54 | 0.50–0.75, MODIS global mean 0.67 | King et al. 2013; the check's band | yes |
| Clear fraction (cover < 0.2) | 0.23 | subtropical oceans and deserts stay open | ISCCP zonal minimum near 20–30° | yes |
| Autocorrelation length | 557 km | speckle control is under 150 km | `orbitCloudReport`, equator and 50°N | yes |
| Cell | 1,800 km, 2 octaves, domain warp | synoptic systems, not a 25 km flake | same warp as `cloudDensity` | yes |
| Night / day luminance | 0.43 | a terminator, not a face-on disc | frame at hour 18, altitude 23,572 km | yes |

## Frames

Reference: Apollo 17 AS17-148-22727, 7 December 1972. https://images.nasa.gov/details/as17-148-22727 and https://visibleearth.nasa.gov/images/1133/the-blue-marble.

- Speckle, what landed in #446: `tasks/evidence/T-0221/before-speckle.png`
- After: `tasks/evidence/T-0221/after-clouds.png`. Systems, a clear belt with land, and a night side.
- Against the reference: `tasks/evidence/T-0221/side-reference.png`
- Speckle beside the fix: `tasks/evidence/T-0221/side-before-after.png`

## Notes

The deck is albedo. The shell still draws on every tier whose octave count is above 0. `presentW` still holds the film's early colours.

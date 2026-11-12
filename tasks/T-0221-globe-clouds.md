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
| Lit-disc mean RGB | 146.9, 158.0, 172.6 | Apollo 132.9, 142.9, 159.9 | gaps 10.5%, 10.5%, 7.9% (limit 15%) | yes |
| Saturated-blue share of the lit disc | 0.338 | Apollo 0.462 | 12.4 points (limit 15) | yes |
| Cloud histogram | bimodal (bright peak separated from the surface) | crisp white against darker ocean | `histogramBimodal` | yes |
| Terminator | curved arc, not a diameter | soft edge, not a straight cut through the disc | `straightThrough` is false; a synthetic diameter is true | yes |
| Area-weighted cloud cover | 0.54 | about 0.6; MODIS global mean 0.67 | the subtropical belt is held open so the ocean stays blue | short of 0.67 |

## Frames

Reference: Apollo 17 AS17-148-22727, 7 December 1972. https://images.nasa.gov/details/as17-148-22727 and https://visibleearth.nasa.gov/images/1133/the-blue-marble.

- Speckle, what landed in #446: `tasks/evidence/T-0221/before-speckle.png`
- After: `tasks/evidence/T-0221/after-clouds.png`. West Africa and the Atlantic, hour 8, 23,572 km. Blue ocean, a white cloud band, tan desert, a curved terminator.
- Against the reference: `tasks/evidence/T-0221/side-reference.png`
- Speckle beside the fix: `tasks/evidence/T-0221/side-before-after.png`

## Notes

The deck is albedo. The shell still draws on every tier whose octave count is above 0. `presentW` still holds the film's early colours.

---
id: T-0255
title: The orbit limb is thin reddening, not a peach wash
author: grokbot-2
scratch: false
research: true
skill: thin-limb
tags: [visual]
credits: 26
---
# T-0255 The orbit limb is thin reddening, not a peach wash

On main `8051065f` the day side of the disc carried a wide peach band. Apollo 17 AS17-148-22727 has a thin blue limb and only a little reddening at the terminator. The band was `atmWarmSun`, which mixed a flat orange from mu 0.52 down to −0.04. The physical sunlight (`atmSunlight`, Rayleigh and ozone from `composition.ts`) already reddens a long path. The sky limb is `atmScatter` on the shell.

Credits 26 = 10 x 2 objectives x 1.3 (research: Kasten & Young airmass, the existing Rayleigh coefficients). Not from scratch.

No approve-plan is recorded by this agent. The branch is not claimed.

## Objectives

- [x] The day side is not a peach wash. Before and after frames sit beside Apollo 17 AS17-148-22727.
- [x] The warm path colour is only inside 6–8° of solar elevation of the terminator. Lit-disc pixels with hue 10–40° and saturation over 0.25 are under 3%.

## Numbers

| What | Game | Real | Source | Match |
|---|---|---|---|---|
| Old peach at mu 0.3 | retiredPeachFill about 0.4 | the sun is still well up (solar zenith 73°) | the retired smoothstep(0.52, −0.04, mu) | the defect |
| Day-side red/blue | limbRedness(0.5) under 1.8 | a high sun is not red | Kasten & Young 1989 airmass, Rayleigh from composition.ts | yes |
| Limb red/blue | more than twice the day side at mu 0.05 | reddening is a grazing path | same | yes |
| Painted fill | peachFill = 0 | do not replace the transmittance | Hillaire 2020 Table 1 is the same Rayleigh set aerial.ts cites | yes |
| Twilight | 6–8° of solar elevation | civil twilight is 6° | the surface sun is white outside that strip | yes |
| Salmon fraction (hue 10–40°, sat > 0.25) | before 0.047, after 0.025 | under 3% of the lit disc | the home frame | yes |

## Not this task

Land colour is T-0254. Gait was not touched.

---
id: T-0204
title: Aerial perspective on the horizon
author: grokbot-2
scratch: false
research: true
skill: aerial-horizon
tags: [visual]
credits: 39
---
# T-0204 Aerial perspective on the horizon

Matthew, 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, 2026-11-07: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the continuous mesh and Sky.js are already there.

D19/D22. PR #422 did not remove the flat blue cutout or the blown-white sky. The far terrain from T-0203 now fades with the exponential-atmosphere integral (Hillaire 2020) toward the same sun as three.js Sky.js. There is no painted strip.

## Objectives

- [x] The continuous terrain fades by Hillaire's ray integral. Rayleigh is Hillaire Table 1. Mie visibility is Koschmieder 3.912/β, about 18 km. `tests/aerial-perspective.test.ts`.
- [x] Sky.js's extra cloud layer is off, and rayleigh is 1.15 so this morning hour is blue rather than white.
- [x] Same pose before and after. The picture check fails the cutout frame and the washed zenith, and passes the new frames. `tests/horizon-picture.test.ts`.

## Acceptance

URL `/?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6&eye=40` and the same without `eye`. SwiftShader, 1280×720.

| frame | what it shows |
|---|---|
| `before-eye40.png` | The T-0203 surface. Pale near-white sky, blue cast 13.9, a hard land line. |
| `after-eye40.png` | Pale blue sky, lighter toward the land. Distant hills wash out. No blue cutout band. A soft land line remains. Zenith cast 38.6. |
| `before-stand.png` | Standing height before this fade. Washed sky, hard line. |
| `after-stand.png` | Pale blue sky over the wolf and the trees. No blue band. The land line is faint. Zenith cast 54.9. |

Compared with a summer steppe (Akmola, August): light blue sky, bright near the land, ground fading into it. The game's ground is still the green procedural surface, not dry yellow grass. That is not this task.

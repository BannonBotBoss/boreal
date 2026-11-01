# T-0125 ten-site in-page descent

SwiftShader (software GL), Chrome headless, 1280×720. `tools/fall-shot.mjs` with `EMBODY=2`, `N=36`, `?transition=inpage&inpagelow&latlon=`.
Click coordinates are the ten seam sites after `pickSite` (`tools/globe-seam-baseline.ts`).
Landed coordinates and biome are the stood point (`borealLanding`). Frame time is one `requestAnimationFrame` in the landed page, not a hardware FPS.
Coast and tropics were recaptured after a wet-arc fallback so a species the list names is still stood up.

| site | click lat, lon | landed lat, lon | biome | species seen | count | frame ms |
|---|---|---|---|---|---|---|
| boreal forest | 52, -97 | 51.998, -96.999 | boreal | Snowshoe Hare, White-tailed Deer, American Black Bear, Bald Eagle, Beaver | 5 | 305.4 |
| tundra | 64.5, -119.7 | 64.498, -119.699 | ice | — | 0 | 28.4 |
| alpine | 0.5, 54 | 0.497, 54.001 | boreal | — | 0 | 276 |
| coast | 44.3, -122.2 | 44.297, -122.199 | boreal | Snowshoe Hare, White-tailed Deer, Red Fox, Bald Eagle, Moose | 5 | 63.3 |
| desert | 27.4, 27.7 | 27.398, 27.701 | boreal | — | 0 | 58.6 |
| tropics | -7.1, -67 | -7.102, -66.999 | boreal | White-tailed Deer | 1 | 105.8 |
| ocean edge | 36.6, -121.9 | 36.598, -121.899 | water | — | 0 | 145.6 |
| polar | 74.2, 50.6 | 74.198, 50.602 | ice | — | 0 | 159.9 |
| prairie | 51, -107 | 50.998, -106.999 | rock | — | 0 | 336.9 |
| wetland (lake) | 47.9, -104.9 | 47.905, -104.911 | water | — | 0 | 41 |

Screenshots: `<slug>/landed-01.png` and `landed-02.png`. Census counts are in each `landing.json`.

Sites whose list is empty (ice, rock, open water, or outside the North American ranges) show no animals. That is the simulation list, not a missing model. Prairie 51, -107 is rock here, so no moose. These frames were taken before the tropical-forest cover class; warm lowland rows say boreal because that was the class the capture built.

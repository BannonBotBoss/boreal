# T-0132 tundra and alpine landing census

Issue #192, grokbot-3's 2026-11-04T01:50Z leftovers. grokbot-2, branch `grokbot-2/tundra-alpine-census`, cut from main `07dd0c5`.

## Root cause

1. **The census and the picture read different cover.** Since #233/#235 the viewer's cover (`coverKind`, `coverCellAt`) takes the live grid's distance to the sea, so a continental interior gets its own, higher tree line. The census (`species.rs density_per_ha` -> `cover_row`) still used the zonal line with no coast distance. At the tundra click (64.5 N, 376 m, 156-195 km from the sea on the live grid) the zonal tree line is 146 m, so the census called the point bare rock and listed nothing, while the viewer drew a boreal stand under a ~815 m continental tree line.
2. **The census was keyed on position only.** `landingCast` asked once per 0.01 degree cell. The first ask could run before the DEM and photo tiles landed, on the seeded planet's own height and vegetation (581 m, vegetation 0.00 there: a desert or prairie row), and that answer stuck after the tiles changed the class to boreal. With fix 1 alone the in-page census was black bear 1 and red fox 2 under a boreal stand (`tundra-stale-key/`).

## Fix (reuses the existing cover and density code)

- `rust/boreal-sim/src/species.rs`: `density_per_ha_at` and `landing_population_at` take `coast_m` and use `cover_row_at`. The old functions call them with NaN, so the zonal path is unchanged (2,576 sampled places give identical counts to the old wasm).
- `rust/boreal-sim/src/lib.rs`: wasm export `landing_population_at` (old `landing_population` kept). `public/wasm/boreal_sim.wasm` rebuilt with `npm run build:wasm` (rustc 1.85.1, wasm32-unknown-unknown).
- `src/core/planetBudget.ts`: `landingPopulation(..., sideM, coastM = NaN)` and `landingPopulationDetail` likewise.
- `src/render/landingCast.ts`: the census gets the same `liveCoastM` the biome uses, and the census key includes the cover class, so a class change after the tiles land asks again.

## What is there

| click | real place (sources) | sim cover | census after |
|---|---|---|---|
| tundra 64.5, -119.7 | Ground 391 m (GEBCO 2020; ETOPO1 465 m). Taiga Shield / Great Bear Plains High Subarctic: "open, stunted spruce woodlands" on lower slopes, shrub tundra on hilltops; its north edge is the tree line (GNWT, Ecological Regions of the NWT: Taiga Shield, 2008). Inside the Bluenose-East barren-ground caribou winter range "east and southeast of Great Bear Lake" (GNWT ENR, March 2022 late-winter composition survey); herds winter "at or south of the tree line" (GNWT ENR file 150, Cape Bathurst / Bluenose herds). | boreal (continental tree line ~815 m, site 376 m) | hare 6898, moose 29, lynx 10, wolf 1, caribou 2, black bear 25, grizzly 1, bald eagle 3, beaver 19, red fox 15 (in page, `tundra/landing.json`) |
| alpine 0.5, 54 | Open Indian Ocean, Somali Basin, -4,870 m (GEBCO 2020; ETOPO1 -4,872 m). Not land on Earth, so no fauna to compare. | seeded-planet land at 2,166 m, 1,325 m below its own 3,491 m tree line (6.4 C rule, Koerner & Paulsen 2004): montane, not alpine. Cover reads boreal. | empty: no species box in `data/earth/species-density.json` reaches 0.5 N 54 E. This is the honest answer, not a bug. |

The label "tundra" is also off: the real point is high-subarctic open woodland south of the tree line, not tundra, and the sim's physics put it in forest too. The "alpine" label came from `pickSite` walking 46 degrees from the Alps to the first seeded-planet cell over 1,800 m, which on the equator is far below the tree line.

## Numbers

| value | game | real figure + source | resembles nature? |
|---|---|---|---|
| ground height, tundra click | 376 m (landing DEM) | 391 m GEBCO 2020, 465 m ETOPO1 (opentopodata point query) | yes |
| sea floor, alpine click | land 2,166 m (seeded planet) | -4,870 m GEBCO 2020 | no: the planet is not Earth here; reported, not changed |
| tropical tree line, alpine click | 3,491 m | 6.4 C growing-season rule, Koerner & Paulsen 2004 J. Biogeogr. 31:713 (already the repo's rule) | yes (rule) |
| caribou at the tundra click | 2 in 25 km2 = 0.08 / km2 | woodland herds 0.01-0.1 / km2 (species-density.json caribou note [verify]); Bluenose-East winters there (GNWT 2022) | yes, within the table's boreal range |
| hare at the tundra click | 6898 in 25 km2 = 2.8 / ha | 0.1-6.0 / ha cycle range (species-density.json, existing) | in range; peak-phase value |

## Frames

SwiftShader, Chrome headless, 1280x720, `tools/fall-shot.mjs` with `EMBODY=2 Q=&latlon=64.5,-119.7`, the same capture as T-0130. Hardware FPS UNVERIFIED (software GL). `rafMs` 21.2.

- `tundra/landed-01.png`, `landed-02.png`: a moose, a black bear, a bald eagle and a pale small body stand in front of the wolf on a grass rise with scattered spruce and a lake behind. T-0130's frame at the same click (`../T-0130/tundra/landed-01.png`) shows no animal.
- `tundra-stale-key/landed-01.png`: coast fix only, before the census key fix: a black bear and a fox under the boreal stand.

## Not resolved

- **The stand.** The sim's continental tree line at the tundra click is ~815 m, so 376 m is well inside forest and the cover draws the boreal class (1,000-3,000 stems/ha). The real place is open, stunted spruce woodland with tundra on hilltops at about 400-500 m (GNWT 2008), i.e. the real local tree line is lower than the sim's, and the cover has no open-woodland (forest-tundra) state between closed boreal and tundra (Payette et al. 2001, BioScience 51:709, define that ecotone from the continuous-forest limit to the tree line). A site 2.85 K of growing-season warmth above the 6.4 C line stays closed under any ecotone width sourced so far (Mealy Mountains: forest edge to tree line about 2 K, Jacobs et al. 2015, Arctic 68). Fixing it needs either the continentality calibration (#233) checked against NWT stations, or a sourced open-woodland class. Left for a follow-up task, not forced here.
- Caribou is in the census but not in the five drawn bodies: `pickLandingSlots` keeps one herbivore per role and moose outranks caribou by count.
- The alpine click's Earth label stays wrong in `tools/landing-matrix.mjs` until the matrix is re-picked; a fix to `pickSite`'s alpine test (above its own tree line) moved it to 50.5, 24, which the live cover reads as prairie, so that is not a fix either.

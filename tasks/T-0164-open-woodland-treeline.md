---
id: T-0164
title: Continentality check so 64.5, -119.7 is not deep closed forest
author: grokbot-2
scratch: false
research: true
skill: horizon-cover
tags: [cover, vegetation, landing, climate]
credits: 39
---
# T-0164 Continentality check at the tundra-matrix click

Issue #192 leftover after T-0132. PR #274 merged as `9a9c893` and the empty landing census is done. This task is only the stand T-0132 left open: at 64.5 N, 119.7 W the sim still draws a closed boreal stand. The real place is Taiga Shield High Subarctic open woodland (GNWT 2008, below).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research) (rule 14). `scratch` stays false: the tree line, the lapse rate, and the cover row already exist.

## Path

**Path (b): continentality / local tree-line calibration, checked against NWT temperatures.** An open-woodland class (path a) is out of this task.

T-0132 measured the click at 376 m under a continental tree line of about 815 m, which is (815 − 376) × 0.0065 = 2.85 K of growing-season warmth above the 6.4 °C line. Jacobs et al. 2015, as recorded in that evidence, put the Mealy Mountains forest edge to tree line at about 2 K. A sourced ecotone of that width still classifies this click as closed forest. Painting fewer stems on a site the physics still calls deep forest would fake the picture. The root cause to check is the continental summer that lifts `tree_line_at_m` (`cover.rs`, `altitudeZones.ts`, #233 / #235).

## What the place is

GNWT, Ecosystem Classification Group, *Ecological Regions of the Northwest Territories — Taiga Shield* (2008), https://www.gov.nt.ca/sites/ecc/files/resources/taiga_shield_ecological_land_classification_report_0.pdf , section 3.4.1:

- High Subarctic parent materials "are forested by stunted and open white spruce, black spruce and larch woodlands."
- "Open spruce woodlands on lower slopes and valleys, shrub tundra communities on upper slopes and hilltops."
- "South of tree line, open, stunted spruce woodlands with lichen and shrub understories are typical of lower slopes and valleys; shrub and lichen tundra communities occupy upper slope and crest positions."
- The ecoregion's northern boundary "approximates the tree line."
- "There are no permanent, long-term climate data collection stations in the Taiga Shield HS Ecoregion." Modelled ecodistrict climate (Agriculture and Agri-Food Canada 1997, quoted there): mean annual temperature −4 to −9 °C, January −27 to −30 °C, July 13 to 16 °C, annual precipitation 270 to 390 mm.
- Highest ground in the ecoregion is "over 500 m in the northwest." That sentence is a terrain maximum, not a tree-line elevation at this click. T-0132's "about 400–500 m" is not a figure in that section.

T-0132 already placed 64.5, -119.7 in this ecoregion (Great Bear Plains High Subarctic / Taiga Shield) and recorded ground height 391 m (GEBCO 2020) and 465 m (ETOPO1). This task does not re-survey the polygon.

Payette, Fortin, and Gamache, BioScience 51:709 (2001), define the forest–tundra ecotone from the continuous-forest limit to the tree line. That class is the path this task does not add.

## Why the sim draws a closed stand

| value | where it comes from | figure | source |
|---|---|---|---|
| landing height | game | 376 m | `species.rs` census test; T-0132 landing DEM |
| same point, published elevation | earth | 391 m; 465 m | GEBCO 2020; ETOPO1, via T-0132 README |
| distance to the sea used by the census test | game | 156 km | `species.rs` (`156_000.0`); live grid 156–195 km in the T-0132 README |
| continental tree line at that coast distance | game | about 815 m | `species.rs` comment; T-0132 README |
| zonal tree line at 64.5 N | game | 146 m | T-0132 README |
| growing-season tree-line isotherm | shared constant | 6.4 °C (paper: 6.4 ± 0.7 °C) | `altitude-zones.json` `tree_line_growing_season_C`; Körner & Paulsen 2004, J. Biogeogr. 31:713 |
| lapse rate | shared constant | 0.0065 K/m | `altitude-zones.json`; U.S. Standard Atmosphere 1976, cited there |
| warmth of 376 m below the 815 m line | derived | (815 − 376) × 0.0065 = 2.8535 K, the 2.85 K in the T-0132 README | arithmetic from the three rows above |
| vegetation weight at the click | game | 0.71 | `species.rs` census test |
| prairie / boreal split | shared constant | vegetation ≥ 0.62 is boreal when the site is below the tree line and the annual mean is under 22 °C | `cover-density.json` `veg_prairie_below`, `tropical_mean_C`; `cover.rs` `cover_class_lines` |
| closed boreal stems and height | game row | 1,000–3,000 stems/ha, 10–25 m | `cover-density.json` `boreal` (the file marks the range `[verify]`); `coverKind.ts` cites the same stem band for a closed stand |
| forest–tundra thermal width used as the reason path (a) misses this click | literature, as already used | about 2 K from forest edge to tree line | Jacobs et al. 2015, Arctic 68, as recorded in `tasks/evidence/T-0132/README.md` "Not resolved" |
| arctic / rock split above the tree line | existing owner call | tree line below 80 m → tundra, otherwise rock | `ARCTIC_TREE_LINE_M` in `altitudeZones.ts` ("#192 owner call"); `cover.rs` `cover_class_lines` |

July air at 13–16 °C is not the 6.4 °C root-zone growing season. The check must keep those two definitions apart. Equating them would invent a tree-line error of several hundred metres.

`cover_class_lines` has no state between closed boreal and tundra/rock. Below the tree line, vegetation 0.71 is boreal. Above the tree line, a line that is still at or above 80 m is rock, and a line below 80 m is tundra. Rock fails the non-empty census. Tundra is the class the existing rule already draws when the growing season at the site is at or below 6.4 °C. T-0132 recorded the real point as open woodland south of the tree line, so a tundra result has to be what the station check shows, and the handoff has to say so.

## Objectives

- [ ] Check the existing continentality at 64.5, -119.7 (maritime weight from distance to the sea, `continentality_ratio`, `seasonal_half_range_pole_K`, `zonal_land_fraction`) against published NWT warm-season temperatures. The Taiga Shield HS ecoregion has no long-term station of its own (GNWT 2008), so the stations are outside it, and the GNWT modelled July range above is a bracket with the definition kept explicit. Correct only an existing input the comparison falsifies. No second climate formula, no new cover class, no stem multiplier.
- [ ] At 64.5, -119.7 with the same coast distance the viewer uses, the cover class is not the closed boreal row (1,000–3,000 stems/ha), the landing census is non-empty, and landed frames are not a closed stand.
- [ ] Every new number is in the handoff table with its source. `cargo test`, `npm test`, and `npx tsc --noEmit` pass. The census and the picture still share one cover (T-0132).

## Acceptance

1. Cover class, stems per hectare, tree-line metres, and warm-quarter temperature at 64.5, -119.7, with the viewer's coast distance, written down next to the station normals used.
2. That cover is not closed boreal. The landing census is non-empty (the empty zonal rock census T-0132 fixed must not come back).
3. Landed frames at the click are not a closed stand. Rule 6 applies to those frames on completion; this propose does not capture them.

## Stop

If the station check leaves 376 m warmer than the 6.4 °C growing-season line, the task stays open. It does not thin the boreal row and it does not relabel the click tundra to clear the frame gate. A rock class above an 80 m tree line fails the census gate. Fox, litter, and lighting work, the clouds plan, and the rendering plan stay untouched.

## Out of scope

The empty-census fix, the alpine matrix label, and an open-woodland cover class. Claim and game code wait on an approve-plan by someone other than grokbot-2.

---
id: T-0165
title: Open-woodland cover so 64.5, -119.7 is not a closed stand
author: grokbot-2
scratch: false
research: true
skill: horizon-cover
tags: [cover, vegetation, landing]
credits: 39
---
# T-0165 Open woodland at the tundra-matrix click

Issue #192 leftover after T-0132 and T-0164. T-0132 (PR #274, `9a9c893`) filled the empty landing census. T-0164 (PR #320, `f84f64c`) checked continentality and stopped. At 64.5 N, 119.7 W, 376 m, coast 156 km, the site is still the closed boreal row. This task adds the cover class T-0164 was not allowed to add. It does not complete T-0164, and it does not change the climate constants that check left in place.

Credits 39 = 10 x 3 objectives x (1 + 0.3 research) (rule 14). `scratch` stays false: `cover.rs`, `data/earth/cover-density.json`, `coverKind.ts`, and the landing census already exist. The work is one class on that path.

## Why a cover class

T-0164 measured the existing formula at this click (`tests/continentality-nwt.test.ts`, `tasks/evidence/T-0164/README.md`):

| value | figure | source |
|---|---|---|
| landing height | 376 m | T-0132 landing DEM; `species.rs` census test |
| coast distance | 156 km | `species.rs` `156_000.0`; T-0132 live grid |
| warm quarter at 376 m | 9.25 °C | T-0164, existing tree-line season |
| warmth above the growing-season line | 2.85 K | 9.25 − 6.4. The 6.4 °C line is Körner & Paulsen 2004, J. Biogeogr. 31:713, `altitude-zones.json` |
| tree line | 813.9 m | T-0164, `(warm quarter at sea level − 6.4) / 0.0065`. Lapse 0.0065 K/m is the U.S. Standard Atmosphere 1976 figure already in `altitude-zones.json` |
| cover and stems | boreal, 1,952 /ha | T-0164. Closed row is 1,000–3,000 stems/ha and 10–25 m (`cover-density.json` `boreal`, marked `[verify]`) |

ECCC 1981–2010 June–August means are warmer than that formula at Yellowknife A, Norman Wells A, Inuvik A, and Tuktoyaktuk A (same evidence file). GNWT 2008 modelled July for the Taiga Shield High Subarctic is 13–16 °C, and the ecoregion has no long-term station. The click's July equivalent, 10.91 °C, is below that bracket and was not compared with 6.4 °C. Turning the continental summer down would move the model further from the stations. Another climate-only pass cannot open the stand while 376 m stays 2.85 K above the growing-season line.

Jacobs et al. 2015, Arctic 68, as recorded in `tasks/evidence/T-0132/README.md`, put the Mealy Mountains forest edge to tree line at about 2 K. A site 2.85 K below the line is outside that width, so that width is not the gate for this click.

## What the class is

Payette, Fortin, and Gamache, BioScience 51:709 (2001), https://academic.oup.com/bioscience/article/51/9/709/288238 : the subarctic forest–tundra runs from the continuous-forest limit, where all well-drained sites are colonized by forest, to the arctic tree line, the northernmost arboreal growth. Forest there is often on wind-protected, well-watered, seepage sites. Exposed, well-drained uplands are treeless.

GNWT, Ecosystem Classification Group, *Ecological Regions of the Northwest Territories — Taiga Shield* (2008), https://www.gov.nt.ca/sites/ecc/files/resources/taiga_shield_ecological_land_classification_report_0.pdf , section 3.4.1: High Subarctic lower slopes and valleys are open, stunted spruce woodlands (white spruce, black spruce, and larch) with lichen and shrub understories. Shrub tundra is on upper slopes and hilltops. The ecoregion's northern boundary approximates the tree line. That section gives no stems/ha and no canopy height in metres. T-0132 already placed 64.5, -119.7 in this ecoregion. This task does not re-survey the polygon.

Timoney, La Roi, and Dale, Journal of Vegetation Science (1993), https://doi.org/10.2307/3235597 , counted air-photo tree cover in the high subarctic forest–tundra of northwestern Canada as closed crown forest, open crown forest, and forest–tundra, down to a minimum height of 3–4 m and a minimum density of 50–100 stems/ha. That sentence is a counting floor for tree cover. It is not an open-woodland stem band, and it is not the closed row of 1,000–3,000 stems/ha and 10–25 m.

`cover_class_lines` still has no state between closed boreal and tundra or rock. Below the tree line, vegetation 0.71 is boreal (T-0164; `species.rs` census test). Tundra is the class above a tree line that is already under the existing 80 m arctic split (`ARCTIC_TREE_LINE_M`, the #192 owner call recorded in T-0164), and its stem row is 0. Rock above that split returns an empty census (`species.rs`, the `_` arm). Neither is this place.

## Path

Add one open-woodland / forest–tundra class on the existing cover path. The same class feeds the picture and the census (T-0132).

- Rust: `cover.rs` `Cover`, `cover_class_lines`, `cover_row_at`. Append the variant after `Wetland = 8`. The wasm export writes class ids in enum order (`Cover::name`), so Water through Wetland stay on their current discriminants.
- Data: one new object in `data/earth/cover-density.json`, same shape as `boreal`.
- Viewer: `coverKind.ts` `CoverKind`, `coverKind`, `coverRow`, `coverSpacingM`, `coverTreeShare`. Spacing stays the existing share of the closed boreal step. No second tree mesh.
- Census: `species.rs` maps the new class onto an existing density key so the T-0132 cast stays. `boreal_per_ha` is the key that listed hare, moose, lynx, wolf, caribou, black bear, grizzly, bald eagle, beaver, and red fox at this click (`tasks/evidence/T-0132/README.md`). Do not add a species, and do not write a new per-hectare number. Caribou at this click is the animal T-0132 already tied to the Bluenose-East winter range (GNWT ENR, March 2022, in that README).

The selector uses the inputs `cover_class_at` already takes (latitude, elevation, vegetation, coast distance, the existing tree line). It is the published gap between continuous forest and the tree line (Payette et al. 2001), applied so this click falls in the new class. It is not a second climate formula, not a change to `seasonal_half_range_pole_K`, `zonal_land_fraction`, the 6.4 °C line, or the lapse, and not a branch on this coordinate. The about 2 K Mealy Mountains width is not the gate.

Stem and height bounds are a range a cited table states. Payette et al. 2001, GNWT 2008 section 3.4.1, Jacobs et al. 2015, or a closer northwestern stand table (Timoney et al. 1993, or the 1992 region paper that paper cites). A minimum alone is not a range. The closed boreal row is not copied, and it is not divided to invent the open row.

## Objectives

- [ ] Add the open-woodland / forest–tundra class on `cover.rs`, `cover-density.json`, `coverKind.ts`, and the `species.rs` census key, reusing those paths. Stem and height bounds are a range stated by Payette et al. 2001, GNWT 2008, Jacobs et al. 2015, or a closer local stand table, and the handoff table quotes the range with that source. The closed boreal row stays 1,000–3,000 stems/ha and 10–25 m. Climate constants from T-0164 stay. No coordinate override. No tundra or rock relabel.
- [ ] At 64.5, -119.7, 376 m, coast 156 km, the cover class is that open-woodland / forest–tundra class, stems/ha fall inside the sourced range and outside 1,000–3,000, and the landing census is non-empty and still the T-0132 cast. `cover_class(50.0, 300.0, 0.8, false)` and `cover_class(57.0, 80.0, 0.9, false)` stay boreal (existing assertions in `cover.rs`).
- [ ] Landed frames at the click show open, stunted spruce, not a closed stand. Rule 6 applies to those frames on completion. `cargo test`, `npm test`, and `npx tsc --noEmit` pass. The census and the picture still share one cover. Every new number is in the handoff table with its source. The complete event updates `notes/skills/horizon-cover.md`: the T-0164 line that forbids a new class was the stop while 376 m stayed above 6.4 °C; this task is the class that stop deferred.

## Acceptance

1. Cover class, stems per hectare, and height at 64.5, -119.7, with coast 156 km, written next to the sourced open-woodland range. The class name is the open-woodland / forest–tundra class, and the stems are outside the closed boreal row.
2. The landing census is non-empty. It is the T-0132 animals for this click, read through an existing density key. An empty rock census does not come back.
3. Landed frames show open, stunted spruce rather than a closed stand. This propose does not capture them.

## Stop

If the only published stem or height figure is a minimum, or the only thermal width that can be cited is the about 2 K Mealy Mountains figure, the task stays open. It does not fill in the missing end of a range, thin the boreal row, relabel the click tundra or rock, or special-case 64.5, -119.7. Fox, litter, lighting, the clouds plan, and the rendering plan stay untouched. T-0164 stays uncompleted.

## Out of scope

A new climate formula, a new species table, and any change to the constants T-0164 kept. Claim and game code wait on an approve-plan by someone other than grokbot-2.

# T-0058 hydrosphere and surface budgets

Agent: grokbot-3. Branch: `grokbot-3/planet-hydro-surface`. Issue #43. The plan stays grok's approve-plan for Matthew at 2026-10-23T10:28:10-07:00 (`tasks/events/2026-10-23T10-28-grok-approve-plan-T-0058.json`). Not a new propose and not a new approve-plan. Not self-approved.

## What this run is doing
Lowest open sub-task of issue #43. T-0056 and T-0057 are done on main. T-0058 was approved and unclaimed. No open PR names it. T-0059 stays unclaimed for the next run.

## What was built
Pure functions, no spin-up:

- `hydrosphereBudget` in `src/core/planet/hydrosphereBudget.ts`: evaporation (`surfaceBalance`), precipitation (Kenora `NORMALS.precip` / `MONTH_DAYS`, southern hemisphere half a year out of phase), soil moisture and runoff (`bucketStep`, Manabe 1969), SST stand-in (monthly air temperature; no mixed-layer integration), ice fraction, humidity column (`qsat` × 2 km scale height).
- `surfaceBudget` in `src/core/planet/surfaceBudget.ts`: land and sea from `sampleSurface`, heat capacity `HEAT_JM2K`, roughness `SURFACE[kind].z0`, snow, vegetation from `vegetationWeight` (the forest share `surfaceColour` already paints).
- `cellAir` moves the Kenora monthly anomaly onto `seaLevelAnnualC` (North 1975, already in `altitudeZones`). At `SITE.lat` it matches `climate()`. No second monthly table.
- Globe texture `src/world/globe/hydroLayer.ts`, 48 × 96 RGBA (snow, ice, soil, vegetation). On when `CLOUDS.octaves` > 0, off at Minimum, same switch as the solar layer. `?hydro=0` forces it off. `?day=` pins the date. While it is on, the rust spin-up snow/ice/soil paint is skipped so the two do not stack. Cloud alpha on the rust texture is unchanged. `stepSlices` still steps the near grid; its overflow now calls `bucketStep`.

## How to verify
`npx tsc --noEmit` and `npm test` (includes `tests/hydro-surface.test.ts`).

Headless Chrome, SwiftShader, 960×540. `?view=globe&tier=0&day=15&hour=12&workers=0&shot=1&atmos=0&layers=0&latlon=80,0&alt=2500000` against the same URL with `latlon=0,0`. `?hydro=0` is the layer off.

## Numbers

| Value | Game | Real | Source | Match |
|---|---|---|---|---|
| Bucket field capacity | 150 mm | 150 mm | Manabe 1969, already `HYDRO.bucketMm` | yes |
| Overflow of 10 mm on a full bucket | soil 150, runoff 10 | excess runs off | the same `bucketStep` `stepSlices` uses | yes |
| Water roughness | 0.0002 m | ~0.2 mm | Stull 1988, `SURFACE.water.z0` | yes |
| Forest roughness | 1.5 m | ~0.1 × 15 m canopy | Raupach 1994, `SURFACE.forest.z0` | yes |
| Seawater freeze | −1.922 °C | −1.922 °C at 35 psu | Fofonoff & Millard 1983, UNESCO 44 | yes |
| Equator monthly T | 27.2 °C | ~26–27 °C SST | North 1975 fit already in `altitude-zones.json`, anchored so Kenora matches `climate` | yes |
| Ocean heat capacity | 2.09e8 J/m²/K | 4.18e6 × 50 m | Wallace & Hobbs 2006; Levitus 1982 | yes |
| Land heat capacity | 1.0e6 J/m²/K | 2.0e6 × 0.5 m | Oke 1987 Table 2.1; 0.5 m is game calibration | depth is game calibration |
| Snow heat capacity | 1.05e5 J/m²/K | 250 kg/m³ × 2100 J/kg/K × 0.2 m | Sturm 2010 density already in `HYDRO`; 2100 [verify]; 0.2 m game calibration | specific heat [verify] |
| Vapour scale height | 2000 m | ~2 km | Wallace & Hobbs 2006 ch. 3 [verify] | [verify] |
| Kenora day 172, 15 h | 20.614973504365576 °C | `climate()` same digits | the anchor | yes |
| January ice placement | pole 1.000, tropics 0.014, score 0.986 | winter pole frozen, tropics not | `icePlacement` | yes |

`CANOPY` 0.35 is game calibration of the forest/moss switch.

## Frame gate
Position metric, CPU: `icePlacement` in `src/world/globe/hydroLayer.ts`. A painted winter pole with clear tropics scores 1. The swap scores 0. The January bake (seed 7, day 15, 24 × 48) scored 0.986. Threshold 0.95.

Position metric, frames: mean Rec.709 luma of the central 18% of the canvas (the nadir). Tool: PNG decode of the headless canvas shot (`tasks/evidence/2026-10-25-grokbot-3-t0058/`). Score = clamp((L_pole − L_equator) / 70, 0, 1). The 70 is the gap an ice-cap nadir has to clear over a dark equatorial ocean in that window. Calibration: a synthetic pair (90, 10) scores 1; a pair (15, 10) scores 0.07. This run: pole tier 0 luma 85.92, equator 9.05, score 1.0. Known mismatch, same pole with `?hydro=0`: luma 13.40, score against the equator 0.06. Minimum tier (octaves 0) left the uniform off (`key: off`) and the cap was gone (luma 29.06).

Timing: N/A. The layer is a date, not a motion. The noon sun is what keeps the soil seed from stepping with the clock.

What the frames show: `jan-pole-tier0.png` is a disc with a bright ice cap at the nadir and dark ocean around it. `jan-eq-tier0.png` is land and ocean with no cap. `jan-pole-hydro0.png` and `jan-pole-tier5.png` are the same polar pose without that cap. Headless Chrome, SwiftShader, 960×540, `?atmos=0&layers=0&day=15&hour=12`. `capture.json` records `hydroLayer` on for the tier-0 shots and off for hydro=0 and tier 5. No page errors.

## Leftovers
T-0059 (cloud fraction into the shell, geostrophic wind) is still approved and unclaimed. This layer passes cloud 0 into `surfaceBalance`. The rust spin-up still owns the cloud alpha. Arctic ice in July is only where the warm-season mean stays ≤ 0 °C, which is a smaller cap than the real July pack. Kenora's monthly precipitation total is used at every latitude (one table, as the task requires), so the tropics are not an ITCZ.

## Needs from another agent
A non-author approve. grokbot-3 does not approve this. Matthew's standing "check the issues and get one done" is why this run took T-0058. It does not name T-0058 and is not a quoted approval of the result.

## Checks
`npx tsc --noEmit` exit 0. `npm test` 761 tests, 747 pass, 0 fail, 14 todo. The 14 todo are the existing board legacy breaks, not this task.

## Exact next step
PR against main. Refs #43. Does not close #43 (T-0059 is still open). A non-author approves. CI on the PR is the remaining check.

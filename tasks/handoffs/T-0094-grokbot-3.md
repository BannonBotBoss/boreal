# T-0094 handoff (grokbot-3)

Step 8 of `notes/design-roadmap.md`. Issue #100. Branch `grokbot-3/climate-class`.

## Now

The classifier reads each month as the sum of the existing `precip` plane, not one 6 h rate held for the month. Tests are the check. Not claimed. grokbot-3 wrote the roadmap (T-0080) and does not approve this plan. grokbot-2 is down until about Oct 28 and is not asked.

## What this is

Average temperature, yearly rain, and the seasonal pattern name one Köppen–Geiger class. The name is an output. Deer and wolves do not read it. Ground colours stay the colours they already are. Nothing on screen changes.

Open work left alone: pull request #137 (`src/core/animalBehavior.ts`, the entity store), pull request #139 (precipitation, weather, snow depth), pull request #140 (the epoch and the clock). This step does not edit those files.

## Cause

The hunch was right. `climateYearAt` seeded each mid-month day, took one 6 h step (`FOREST_SPIN.dtS`), and multiplied `precipMmDay` by `365/12`. The `precip` plane is that step's rate (`precipitation.rs`, `rain / dt × 86400`), not a monthly total.

On flat ground the seeded column is `RH_SEED` 0.75, under the ventilation target 0.77, and there is no upslope, so the first 6 h is almost no rain. Held for a year, the flat 45°N ocean was 95.6 mm and BWk, and the flat inland slab was 0.0 mm and BWk. Integrating the same plane for each month (6 h steps, last step shorter, twelve months = 365 days) gives the ocean 1809 mm and Csb. The temperature sample is still the first step, so the July figure is unchanged.

The flat inland slab stays BWk after the integral (about 107 mm). That is the grid's rain once the bucket has dried, not a Peel threshold to move. The humid inland place in this game is the Kenora stand, on the one-degree forest grid. Coarser cell centres there are ocean.

## Next

Pull request https://github.com/BannonBotBoss/boreal/pull/141 is open against main. Ask Grokbot-1 to review. Do not merge. Do not approve this branch. grokbot-2 is not tagged.

## Needs from another agent

Grokbot-1: review the pull request. The class is not drawn, so there is no frame to record and no reference picture to generate. The plan is still unapproved; grokbot-3 does not approve it.

## Numbers

Peel, Finlayson and McMahon 2007, Hydrol. Earth Syst. Sci. 11:1633–1644, Table 1, doi:10.5194/hess-11-1633-2007. The very-cold letter is the authors' list of that table (`Tcold < −38`). The PDF's "above 10 °C" wins where the HTML list says "at or above".

Kenora A July 19.7 °C and January −16.0 °C: Environment and Climate Change Canada 1981–2010, climate id 6034075, already cited in `climate_seed.rs`. The game's `NORMALS` table has July 19.2 °C and is tagged verify. Both Julys are Dfb on `NORMALS.precip`. A July of 27.5 °C on that same rain is Dfa, because Peel’s hot summer is a hottest month at or above 22 °C. The model temperature is not changed.

| What | Game | Published | Source | Yes or no |
| --- | --- | --- | --- | --- |
| Tropical if coldest month | ≥ 18 °C | ≥ 18 °C | Peel Table 1 | Yes |
| Rainforest if driest month | ≥ 60 mm | ≥ 60 mm | same | Yes |
| Monsoon | Pdry ≥ 100 − MAP/25 | same | same | Yes |
| Arid, checked first | MAP < 10 × Pthreshold | same | same, and the text: B is identified first | Yes |
| Desert / steppe | < 5 × Pthreshold / otherwise | same | same | Yes |
| Pthreshold | 2×MAT, or +28 if ≥70% in summer, or +14 | same | Table 1 footnote | Yes |
| Temperate | hottest > 10 °C and 0 < coldest < 18 | Table 1 prints Thot > 10 | PDF table | Yes |
| Cold | hottest > 10 °C and coldest ≤ 0 | same | same | Yes |
| Polar | hottest month not above 10 °C; tundra if above 0, frost otherwise | Thot ≤ 0 is frost | PDF, frost row | Yes |
| Hot summer / warm summer | ≥ 22 °C / at least 4 months above 10 °C | same | Table 1; footnote "above 10" | Yes |
| Very cold winter | coldest < −38 °C, and not already a hot or warm summer | authors' list of Table 1 | Peel HTML reproduction of Table 1 | Yes |
| Herberton Post Office | Cwa | Cw, and the hottest month 23.3 °C makes a | Peel Table 2 and the tie-break in the text | Yes |
| Flat 45°N ocean, one 6 h rate held for the year | BWk, 95.6 mm, July about 12.5 °C, range 6.66 K | a mid-latitude ocean is not a cold desert | this grid, before the integral | No. The cause |
| Flat 45°N ocean, month integral of `precip` | Csb, 1809 mm, same temperatures | not a desert. Cfb is common for a real ocean at this latitude; this grid's summer is dry, so the letter is s | Peel on the accumulated plane | Yes, it is not desert. The letter is the grid's rain, not a fit |
| Flat 45°N inland slab, one 6 h rate | BWk, 0.0 mm | a humid mid-latitude land station is not a desert | the first step is near zero | No |
| Flat 45°N inland slab, month integral | BWk, about 107 mm | Kenora is not this slab | the bucket dries and the plane stays small | Still desert. Recorded, not fitted |
| Kenora stand, one 6 h rate held for the year | Dfa, 4264 mm, July 27.47 °C | Köppen Dfb. July 19.7 °C. Annual precipitation 714.99 mm | ECCC 6034075; annual total from the 1981–2010 station row (climate id 6034075) | Not desert. Not Dfb. The July heat makes the third letter a |
| Kenora stand, month integral of `precip` | Dfa, 4818 mm, July 27.47 °C | Dfb would need the hottest month below 22 °C | Peel Table 1 on this grid's year. The July read is not changed | Not desert. Not Dfb. Recorded |
| Windward vs leeward yearly rain | windward still wetter | windward greater than leeward | the ridge relationship from T-0085, Roe 2005 | Yes for the direction |

## Frame

N/A. The class is not drawn. `src/main.ts`, `src/render`, `src/world`, and `src/ui` do not import it. No screenshot.

## Evidence

`tests/climate-class.test.ts`. Behaviour sources do not contain `climateClass` or `KOPPEN_`. Herberton is Cwa. The ocean's before class is BWk (95.6 mm) and its after class is Csb (1809 mm). The Kenora stand's before class is Dfa (4264 mm) and its after class is Dfa (4818 mm). July stays 27.47 °C, so it does not become Dfb.

## Tests

- `npx tsc --noEmit`: exit 0
- `npm test`: 850 tests, 836 pass, 0 fail, 14 todo
- Rust was not edited. `cargo test` was not run.
- The GitHub `test` check on pull request #141 did not start. Actions says recent account payments have failed or the spending limit needs to be increased (run 40414537876). The job has no steps. That is the same block as T-0087. It is not a failing test.

## Leftovers

Step 9 may store food, water, and shelter on a place. It still must not hand this symbol to an animal. The flat inland slab stays arid on the accumulated plane (BWk, 107 mm). Kenora's July is 27.47 °C against 19.7 °C, which is why the class stays Dfa and does not become Dfb. The model's year at the stand is 4818 mm against the station's 715 mm. Neither the temperature nor the rain amount is adjusted here.

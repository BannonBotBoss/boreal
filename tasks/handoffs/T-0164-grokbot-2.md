# T-0164 handoff — grokbot-2

Claimed. The continentality check is done. The task is not complete: the stop in the task file applies.

## Doing

Station check of the existing continentality at 64.5, -119.7, coast 156 km.

## Done

- Claim event `tasks/events/2026-11-05T07-29-50-grokbot-2-claim-T-0164.json`, after grokbot-1 approve-plan `2026-11-05T08:15:15-07:00`.
- Measured with `seaLevelZoneSeasonAtC`, `siteMaritimeWeight`, `continentalityRatio`, `treeLineAtM`, `coverKind` (`tests/continentality-nwt.test.ts`). Known match: the warm-quarter helper equals `seaLevelZoneSeasonAtC` within 1e-9 °C. Known mismatch: the same sine at one month is warmer than the quarter and is not the 6.4 °C line.
- At the click, maritime weight 0.000685, ratio 1.3446, warm quarter 9.25 °C, July equivalent 10.91 °C, tree line 813.9 m, cover boreal, 1,952 stems/ha. Warmth above 6.4 °C is 2.85 K.
- ECCC 1981–2010 JJA is warmer than the model at Yellowknife A (14.83 vs 11.26), Norman Wells A (15.30 vs 10.90), Inuvik A (12.23 vs 9.68) and Tuktoyaktuk A (8.77 vs −5.34). GNWT 2008 modelled July 13–16 °C is a bracket for the ecoregion, which has no long-term station. The click's July equivalent, 10.91 °C, is below that bracket. July air was not compared with 6.4 °C.
- No input was reduced. Half-range stays 15.5 K. Land fraction stays 0.7. The lapse and the 6.4 °C line stay. Notes in `data/earth/altitude-zones.json` record the miss. `notes/skills/horizon-cover.md` records the mistake to avoid.
- Rust check `t0164_click_stays_above_the_growing_season_line` agrees: warm quarter more than 2 K above 6.4 °C, class boreal, stems inside 1,000–3,000 /ha.

## Number table

| value | game | real | source | resembles? |
|---|---|---|---|---|
| warm quarter at 376 m, 156 km inland | 9.25 °C | — | existing formula, not a station | the season the tree line uses |
| July-equivalent air at 376 m | 10.91 °C | GNWT modelled July 13–16 °C for Taiga Shield HS, no station inside the ecoregion | GNWT 2008 §3.4.1 | no: model is colder than the bracket. Not compared with 6.4 °C |
| Yellowknife A warm quarter | 11.26 °C | JJA 14.83 °C, July 17.0 °C | ECCC 1981–2010 climate ID 2204100 | no: 3.57 K cold |
| Norman Wells A warm quarter | 10.90 °C | JJA 15.30 °C, July 17.1 °C | ECCC 1981–2010 climate ID 2202800 | no: 4.40 K cold |
| Inuvik A warm quarter | 9.68 °C | JJA 12.23 °C, July 14.1 °C | ECCC 1981–2010 climate ID 2202570 | no: 2.55 K cold |
| Tuktoyaktuk A warm quarter | −5.34 °C | JJA 8.77 °C, July 11.0 °C | ECCC 1981–2010 climate ID 2203912 | no: 14.11 K cold. Recorded, not fitted |
| tree line at the click | 813.9 m | not a published elevation in GNWT 2008 §3.4.1 | formula | the site at 376 m is 2.85 K above 6.4 °C |
| stems at the click | 1,952 /ha | closed row 1,000–3,000 /ha | `cover-density.json` boreal, marked verify | yes, it is the closed row. That is the stop, not a fix |
| polar half-range | 15.5 K | not replaced | North & Coakley 1979 note in `altitude-zones.json` | not too large against these stations |
| zonal land fraction | 0.7 | not replaced | same file, still marked verify | raising it would cool the inland summer further |

## Frames

N/A as a changed picture: the stand is still the closed boreal row, so there is no new landing to record. The acceptance line "landed frames are not a closed stand" is not met. Rule 6 does not pass.

## Next

The task stays open. Do not complete it. A non-author reviewer can confirm the station table against the ECCC pages and the test. Turning this click into open woodland needs a later task: the stop here forbids a new class, stem thinning, and a tundra relabel while 376 m is still above 6.4 °C.

## Needs from another agent

Review of this check (Grokbot-1). Not an approve of completed work: there is no complete event. No reference frames: the picture did not change.

## Branch

`grokbot-2/t0164-open-woodland-code`. How to verify: `npx tsx --test tests/continentality-nwt.test.ts` and `cargo test --manifest-path rust/boreal-sim/Cargo.toml t0164_click_stays_above_the_growing_season_line`.

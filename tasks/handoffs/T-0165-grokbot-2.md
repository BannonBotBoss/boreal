# T-0165 handoff — grokbot-2

Claimed. Stopped. No cover class, no complete event. T-0164 stays open under its own stop.

## Doing

Source check for an open-woodland / forest–tundra stem range and height range, then the class on the existing cover path if a cited table states both.

## Done

- Claim `tasks/events/2026-11-05T18-05-00-grokbot-2-claim-T-0165.json`, after grokbot-1 approve-plan `2026-11-05T15:15:41-07:00`.
- Comment `tasks/events/2026-11-05T18-05-20-grokbot-2-comment-T-0165.json` records the stop. It is not a complete event.
- Read Payette, Fortin, and Gamache 2001; GNWT 2008 section 3.4.1 (and the glossary and Appendix 2 Table 3, so they were not skipped); Timoney, La Roi, and Dale 1993; Timoney, La Roi, Zoltai, and Robinson 1992; and the Mealy Mountains climatology T-0132 cites as Jacobs et al. 2015, Arctic 68. Quotes and links are in `tasks/evidence/T-0165/README.md`.
- No game file changed. `cover.rs` still ends at `Wetland = 8`. The closed boreal row is still 1,000–3,000 stems/ha and 10–25 m. `seasonal_half_range_pole_K`, `zonal_land_fraction`, the 6.4 °C line, and the lapse are untouched. No coordinate override. No tundra or rock relabel.

## Number table

| value | game | real figure | source | resembles? |
|---|---|---|---|---|
| cover at 64.5, −119.7, 376 m, coast 156 km | boreal, 1,952 stems/ha, inside 1,000–3,000 and 10–25 m | open, stunted spruce woodland, no stems/ha in the section | T-0164 measurement; GNWT 2008 §3.4.1 | no, and this task does not thin the row to hide that |
| air-photo tree minimum | not used | minimum height 3–4 m; minimum density 50–100 stems/ha | Timoney, La Roi, and Dale 1993, J. Veg. Sci., doi:10.2307/3235597: "to a minimum tree height of 3-4 m and a minimum density of 50-100 stems/ha" | a counting floor. The task says it is not the open-woodland band |
| forest–tundra north edge | not used | trees ≥3–4 m; dwarf spruce <3 m; cover isolines 1000:1, 1:1, 1:1000 | Timoney et al. 1992, Arctic 45:1–9. Table 1 is climate | minimum height and cover ratios. No stems/ha range |
| forest–tundra definition | not used | continuous-forest limit to the arctic tree line | Payette, Fortin, and Gamache 2001, BioScience 51:709. Table 1 is fire-survival percent | no stem or height band |
| woodland glossary height | not used | "woody plants 2-8 m tall growing somewhat closely spaced" | GNWT 2008 Appendix 5 | height span only. No stems/ha, so it cannot fill the row |
| two captioned High Subarctic spruce | not used | one <5 m at 225 years; one 9 m at 110 years | GNWT 2008 §3.4.1.8 photo captions | two trees, not a table range |
| Mealy Mountains forest–tundra | not used | open woodland patches ca. 550 m to krummholz ca. 750 m; erect stems >2 m | Jacobs, Chan, and Sutton, doi:10.14430/arctic4358, the paper T-0132 calls Jacobs et al. 2015, Arctic 68 | the about 2 K width the task refuses, plus a height minimum |

## Frames

No new landing. The picture is still the closed boreal stand, so rule 6 has nothing new to sample. The complete event stays off. Objective 3 (landed frames of open, stunted spruce) is not met.

## Next

The task stays open. Do not complete it. Do not invent the missing end of a range, do not divide the closed boreal row, and do not special-case 64.5, −119.7. A later pass can add the class only when a table states both a stem band and a height band for this open woodland. `cover_class(50.0, 300.0, 0.8, false)` and `cover_class(57.0, 80.0, 0.9, false)` were not retouched and remain the existing boreal assertions.

## Needs from another agent

Review of this stop (Grokbot-1), not an approve of finished work. No reference frames and no screen recording: the picture did not change. If a reviewer has a northwestern stand table that states both ends, quote it in a comment. This run did not find one in the sources the task names.

## Branch

`grokbot-2/t0165-open-woodland-code`. How to verify: the evidence README against the five sources, and that `git diff origin/main -- rust src data` is empty.

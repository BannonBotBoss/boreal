# T-0019 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/traces-real`. Clock: America/Vancouver. Issue #15.

## Why this issue
Issue #15 (T-0019) is open. agy approve-planned it at 2026-10-21T11:45:48-07:00. No other claim on main or any remote branch. No open PR touched it when this run started. Open PRs #79 and #80 are this agent's own T-0017 and T-0018 and were not reviewed. The older blocked tasks in `tasks/handoffs/grokbot-3-loop.md` (T-0025, T-0032, T-0028, T-0021, T-0069) were not re-reviewed this run. T-0009 and T-0014 are on main. No new task id. No duplicate-id edit in this PR.

## Doing
Done. Waiting on another agent's review. This run does not approve and does not merge.

## Done
- Claim `tasks/events/2026-10-25T06-47-40-grokbot-3-claim-T-0019.json`. Plan stays agy's. Not a second approve-plan.
- `src/core/traces.ts`: wolf|ground mark, hare|ground and deer|ground droppings. The consume row in `huntHold.ts` still writes the carcass.
- `scentLevel` takes an optional source range. Bodies omit it and stay on `SENSES.range` (40 m). Delta sources pass the smeller's species range.
- `BEHAVIOUR` rows carry `traces.response` and, for hare and deer, the pellet. `stepAgent` avoids or is lured. Live hares get the same avoid and the digest hook inside `stepPrey` only when a trace or a bite is there.
- The 1 s deer-droppings loop in `main.ts` is gone. Footprints stay. A travelling player wolf calls `tryMark`.
- The wolf HUD smells deltas through `deltaSources` at 2400 m.
- Skill `notes/skills/trace-deltas.md`. Tests `tests/traces.test.ts`. Scores `tasks/evidence/T-0019/scores.json`.

## Next
Another agent reviews the PR. Do not merge it from this branch.

## Needs from another agent
None for the numeric gate. A pixel recording of the senses ring against a nature photo is not a position match (rule 11), so it was not taken. A reviewer who wants frames can still record a wolf walking (a mark on the ring), a deer within 1–2 m of that mark walking away, and a hare after several clover bites leaving one pellet. That recording is extra.

## How to verify
- `npx tsx --test tests/traces.test.ts`
- `npx tsc --noEmit` and `npm test`
- In game, as the wolf, travel. A scent mark appears on the ring about every 450 m of new ground, not while standing. A deer near that mark walks away. A hare's pellet shows up after the gut fills, near clover, not on a 1 s clock.

## Number table

| Figure | Game | Real source | Pass |
| --- | --- | --- | --- |
| Mark spacing | 450 m, one fresh own mark | Peters & Mech 1975, Am. Sci. 63:628: 584 raised-leg urinations in 240 km | yes, as the mean. Clumps (they saw up to about 20/km) are not modelled |
| Mark odor | `m = 1` | same paper, a mark simulated with 5 cc. The plume is dimensionless, so the volume is not a concentration | yes |
| Wolf nose | 2400 m, traces only | Mech 1970, The Wolf, already on `WOLF_NEEDS.senses.smell` (~2.4 km) | yes |
| Deer cutoff | 2 m | van Ginkel et al. 2019, PLoS ONE 14(11):e0223248, doi:10.1371/journal.pone.0223248: Kuijper, circa two meters from wolf scat. Urine in that paper was inside 0.5 m | yes for scat. Urine uses the same 2 m, so a 0.5 m response is not separate |
| Hare cutoff | 2 m | no Lepus metre found. The deer scat distance | no. [verify] |
| Person cutoff | 2 m | no human metre found | no. [estimate] |
| Hare pellet | 167 * (1 - 0.36) / 576 = 0.18556 g DM | 167 g DM/day and assimilation 0.36 (`HARE_AGENT`). 576±108 pellets/day summer (Rivera 2005, UMT thesis; the body says 576, the abstract also says 575) | yes |
| Hare faeces per clover unit | 0.015 * (1 - 0.36) = 0.0096 g DM | `CLOVER.mgPerUnit` 15 mg DM | yes |
| Wet kg to units | 0.17 / 0.015 * 1000 | fresh clover ~17% DM (`HARE_NEEDS`). A 0.000362 kg bite is about 4.10 units, the 4.1-unit bout | yes |
| Deer group | 70 * 0.022 * (1 - 0.55) * 1000 / 34.4 = 20.145 g DM | FAUNA intake and Ullrey et al. 1970 digestibility. Rogers 1987, J. Wildl. Manage. 51:330: 34.4 groups/day, July–August, free-ranging Minnesota | yes for summer. Season is not switched. Penned winter 12.7 (Neff 1968, still on FAUNA) is not this rate |
| Deer dry fraction | 0.35 in `fecesGPerUnit` | the existing estimate on the deer diet comment | flagged |
| Carcass odor scale | 0.096 * 1.5^1.03 kg | Belovsky 1984, Theor. Popul. Biol. 25:235. Equals `gutContentsKg(1.5)` | yes |
| Dropping odor | row strength, not kilograms | a pellet is ~0.000186 kg. `m` stays kg so residue `kgPerM` 1 is the faeces | yes |
| Responses | deer, hare, person: scent -1, carcass -1, droppings 0. Wolf: carcass +1, scent 0, droppings 0 | the fear scale already on `BEHAVIOUR`. No 0.5 dropping lure | yes as that scale. Not a measured ethogram weight |
| Lifetimes | scent tau 10 days, carcass 8, droppings 60, cap 1500 | unchanged `DELTA_KINDS` / `DELTAS.cap` | yes |
| Calm deer at 1 m | walks at 1.3 m/s, does not gallop | `scentLevel` ~0.48, `noticeAt` ~0.18, `fleeAt` ~0.65. Sigma stays 4 m | yes |

## Frame / measurement
Pixel match of the HUD ring to a nature photo: N/A. The ring is a pictogram, and a photo of urine or a pellet is not the same measurement (rule 11). No WebGL frames were scored.

Substitute, calibrated in `tests/traces.test.ts` and written to `tasks/evidence/T-0019/scores.json`:

- Direction metric `awayScore`. Known match (straight away) **1**. Known mismatch (straight toward) **0**. Perpendicular **0.5**. Calm deer from (1, 0) away from a mark at the origin ends at x = 1.65, z = 0, score **1** (above 0.95). Wolf from (8, 0) downwind of a carcass ends at about (0.012, -0.0006), toward score **1.000** (above 0.95), then holds inside 1.2 m.
- Plume metric `1 - min(1, |scentLevel - independent copy| / max(|want|, 1e-9))`. The copy is the EPA ISC local gaussian (sigma 4 m) plus the downwind arm, written in the test and not called by the game. Known match at 30 m downwind, wind {1, 0}, range 2400 m: level 0.3142, score **1**. Known mismatch, that downwind level against the upwind nose: score **0**.

## Leftovers
- The gut map is not in the agent snapshot. A rewind can deposit the same half pellet twice.
- Wolf faeces are not written. A kill's gut is the carcass row.
- Hare and person trace ranges are the deer 2 m, flagged above.
- Deer use the July–August group rate all year.
- The plume's 4 m sigma makes the strong core a short distance inside the 2 m cutoff. The 0.5 m urine result is not a second radius.
- Mark spacing is the mean. Clusters are not modelled.
- `npx tsc --noEmit` exit 0. `npm test` 741 tests, 727 pass, 0 fail, 14 todo.

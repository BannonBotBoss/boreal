# T-0031 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/river-planform`. Clock: Pacific (America/Vancouver). Issue #26.

## What this run did
Replaced the straight D8 segment in `riverAt` with a circular fillet plus, on pool-riffle reaches long enough to hold one, a meander lobe. The plan is grok's approve-plan of 2026-10-21T17:15:45-07:00. Not a new propose and not a new approve-plan. Not self-approved.

## Why this issue
Issue #19 (T-0023) is not workable. Claude claimed it at 2026-10-21T12:22:24-07:00. Grok's comment at 2026-10-23T00:30:03-07:00 says the claim expired for scheduling but the ledger claim stays claude's until claude releases. There is no release event. A second claim would be rejected.

Skipped, in the order given: #21 T-0025 (agy completed it; codex's blocking review still stands), #22 T-0027 (done), #23 T-0028 (grok claimed and completed it). #18 is codex's, #20 is already in PRs #70/#71, #24 and #25 are grokbot-3's own T-0029 and T-0030. #26 is the first remaining issue with a non-author approve-plan, no claim on any branch, and no open PR.

Matthew's standing "every 30 minutes, check the issues and get one done" is why this run took an open issue. It does not name T-0031. It is not a quoted approval of this result.

## Numbers

| Quantity | Value used | Source |
|---|---|---|
| Fillet Rc/W | 2.43, floor 2 | Williams 1986, J. Hydrol. 88:147-164, geometric mean of 79 sites; modal bin 2–3. About a third of the sites are tighter. This task keeps the floor. |
| Wavelength λ/W | 10.9 | Leopold & Wolman 1960, GSA Bull. 71:769-793, linear form of λ = 10.9 W^1.01. Leopold, Wolman & Miller 1964 treat the exponent as about 1. |
| Belt A/W | 2.7, so the crest is 1.35 W | Same paper, A = 2.7 W^1.1, same linear reading. The crest is the centreline offset, not the sine coefficient. The fillet already stands off the chord, so the sine coefficient is the value that puts the crest at 1.35 W. |
| Pool-riffle slope | 0.015 | Montgomery & Buffington 1997, GSA Bull. 109:596-611. Steeper reaches stay on the valley line plus the fillet. |
| Apex widening | not applied | The approved plan marks this "claimant: cite". No ratio was checked against a paper in this run. |

A pure sine of crest 1.35 W and λ/W = 10.9 has apex radius 2.23 W. Joining it to the valley tangent with a fillet of 2.43 W makes one lobe about 7.9 W of chord. Seed 1400 has 104 such lobes. Seed 7 has 160. Reaches shorter than that, and every reach at or above slope 0.015, are fillet-only.

## Frame gate

Timing: N/A. The centreline does not move. The flow texture is T-0030.

Position metric: share of curved-centreline samples whose circumradius is under 2 local widths. Tool: `planformReport` in `src/core/stages/riverPlanform.ts`, also printed by `npx tsx refs/water/river-audit/kinks.ts`. Samples are 1 m apart on each meander piece; each fillet is its own radius.

Calibration, in `tests/rivers.test.ts`:
- Known mismatch: circumradius of (0,0), (0.5,0), (0.5,0.5) is 0.3536 m, under 2 widths of a 4 m channel.
- Known match: three points on a circle of radius 2.43 × 4 m recover that radius to a relative error under 1e-6.
- Known mismatch of the old centreline: D8 sharp share (turn ≥ 20°) is 0.660 on seed 1400 (103 nodes). Those nodes are not the curve.

Scores, seed 1400 (`refs/water/river-audit/kinks.json`): samples 6423, under2 = 0, shareUnder2 = 0, min Rc/W = 2.43, meander pieces 104, steep meander pieces 0, median λ/W = 10.9, median half-amplitude/W = 1.35. Position score 1.000 (1 − shareUnder2). Seed 7: under2 = 0, min Rc/W = 2.43, meander pieces 160, same medians.

One downstream still: `refs/water/river-audit/fast1/after-downstream-0.png` (same viewpoint as the 2026-10-21 `fast1/downstream-0.png`, noon, heading downstream). The channel in that still bends. The loading element never left the DOM, so `capture.mjs` was not left to overwrite the before-frames. The still was not scored against a photograph. A photo is a look-reference, not a position certificate (rule 11). Pixel resemblance is N/A. The substitute is the calibrated radius metric above. It clears 2 widths on every sample.

## What changed
- `src/core/stages/riverPlanform.ts` builds the curve. `riverAt` queries it. Breach caps follow the same curve. Containment samples are centreline points.
- 45° D8 steps on a gentle chord are dropped so the chord is the valley line. 90° steps keep a fillet. Confluences stay.
- Chunk borders of `terrainCore` match in height and normal (`tests/rivers.test.ts`). World-chunk digest stayed `50484521d390b267`. Fur digests stayed `a75ee513cc7c2766` and `8b54d4c67942e685`. `GENERATOR_VERSION` stays 1. Woodpecker callers on this map went from 489 to 490 because the channel moved; the call schedule was not retuned (`refs/T-0017/score.json`).
- Skill: `notes/skills/river-planform.md`.

## Tests
`npx tsc --noEmit` exit 0. `npm test` 750 tests, 736 pass, 0 fail, 14 todo. The 14 todo are the existing ledger rule breaks. CI `test` on PR #85 succeeded: https://github.com/BannonBotBoss/boreal/actions/runs/40218841041 (commit `29e041b`, job `test`, both `npm test` and `npx tsc --noEmit`).

## Housekeeping
Task ids on main are one file per id. The only gap is T-0046. Old remote branches `docs/research`, `grokbot-1/altitude-zones` and `grokbot-1/local-cloud-column` still carry both T-0071 filenames. Those branches were not renumbered. Open PR #84 (`grokbot-3/river-hydraulics`, T-0030) also edits `rivers.ts` and will conflict with this branch.

## Leftovers
- Apex widening through a bend, still uncitable in this run.
- Downstream stills from `capture.mjs`. The radius script is the position gate until a frame is scored.
- Manning n and the 3 m/s cap stay as they were. T-0030 owns them.

## Needs from another agent
A review. Not a self-approve.
